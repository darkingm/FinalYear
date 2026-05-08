from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
import httpx
import os
import json
import asyncio
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

app = FastAPI(title="CryptoMarket AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Keys & Config ────────────────────────────────────────────────────────
GROQ_API_KEY      = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL        = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL      = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GROK_API_KEY      = os.getenv("GROK_API_KEY", "")
GROK_MODEL        = os.getenv("GROK_MODEL", "grok-3-mini-fast")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL   = os.getenv("OPENROUTER_MODEL", "google/gemma-3-12b-it:free")
MAIN_SERVICE_URL  = os.getenv("MAIN_SERVICE_URL", "http://main-api:3001")

# Cascade order for the un-authenticated path (general chit-chat). Gemini
# has the best free-tier quota and tone for VN, so it leads. Groq is the
# tool-calling agent for logged-in users and stays as a chat fallback if
# Gemini is rate-limited. OpenRouter / Grok are extra backups.
PROVIDERS: list[str] = []
if GEMINI_API_KEY:
    PROVIDERS.append("gemini")
if GROQ_API_KEY:
    PROVIDERS.append("groq")
if OPENROUTER_API_KEY:
    PROVIDERS.append("openrouter")
if GROK_API_KEY:
    PROVIDERS.append("grok")

# Tool calling only runs on Groq (we don't bother implementing the Gemini
# functionDeclarations format in this service). When the user is logged in
# we always try Groq FIRST regardless of cascade order.
TOOL_PROVIDER = "groq" if GROQ_API_KEY else None

PRIMARY = PROVIDERS[0] if PROVIDERS else "none"
logger.info(f"AI providers available: {PROVIDERS}, chat-primary: {PRIMARY}, tool-provider: {TOOL_PROVIDER}")

SYSTEM_PROMPT = """Bạn là AI Assistant của CryptoMarket - sàn thương mại điện tử Web3.

Nhiệm vụ:
1. Giải đáp giá coin, thị trường crypto, sản phẩm
2. Hướng dẫn mua hàng, thanh toán crypto, escrow
3. Hỗ trợ kết nối ví, RWA token hóa
4. **Khi user đã đăng nhập, bạn có thể giúp họ thao tác trực tiếp với tài khoản qua các tool:**
   - Xem / cập nhật profile (username, phone, address_line, avatar_url, paypal_email)
   - Xem ví đã liên kết, đặt ví chính, gỡ liên kết ví
   - Đặt ví nhận thanh toán cho seller (payout wallet)
   - Xem đơn hàng gần đây

QUY TẮC dùng tool:
- Chỉ gọi tool khi user thực sự muốn thao tác (không gọi để "show off").
- Với hành động phá huỷ (gỡ ví, đổi email...) → HỎI XÁC NHẬN trong chat trước khi gọi tool.
- Liên kết ví MỚI cần user ký bằng MetaMask → KHÔNG có tool cho việc đó, hướng dẫn user vào /wallet.
- Thanh toán đơn hàng cần MetaMask → KHÔNG có tool, hướng dẫn user vào checkout.
- Đổi mật khẩu phải qua "Quên mật khẩu" — không có tool.

Trả lời thân thiện, ngắn gọn, tiếng Việt."""


class ChatMessage(BaseModel):
    role: str
    content: str
    # Pass-through for tool-calling history (assistant tool_calls + tool results)
    tool_calls: Optional[List[Any]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_id: Optional[str] = None
    context: Optional[str] = None


# ── Tool definitions (OpenAI / Groq schema) ──────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_my_profile",
            "description": "Đọc profile hiện tại của user đang đăng nhập (username, email, phone, address_line, avatar_url, paypal_email, wallet_address). Dùng khi user hỏi 'thông tin của tôi', 'profile tôi'…",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_my_profile",
            "description": "Cập nhật một hoặc nhiều trường trong profile của user. Truyền chỉ những trường cần đổi. Đổi email cần xác nhận với user trước.",
            "parameters": {
                "type": "object",
                "properties": {
                    "username": {"type": "string", "description": "Tên hiển thị mới"},
                    "phone": {"type": "string", "description": "Số điện thoại"},
                    "address_line": {"type": "string", "description": "Địa chỉ giao hàng"},
                    "avatar_url": {"type": "string", "description": "URL ảnh đại diện"},
                    "paypal_email": {"type": "string", "description": "Email PayPal để nhận thanh toán fiat"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_my_wallets",
            "description": "Liệt kê tất cả ví đã liên kết với tài khoản (address, chain, primary, verified).",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "unlink_wallet",
            "description": "Gỡ liên kết một ví khỏi tài khoản. PHẢI hỏi xác nhận user trước khi gọi.",
            "parameters": {
                "type": "object",
                "properties": {"wallet_id": {"type": "integer", "description": "wallet_db_id từ list_my_wallets"}},
                "required": ["wallet_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_primary_wallet",
            "description": "Đặt một ví đã liên kết làm ví chính (mặc định khi mua/bán).",
            "parameters": {
                "type": "object",
                "properties": {"wallet_id": {"type": "integer"}},
                "required": ["wallet_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_seller_payout_wallet",
            "description": "Đặt ví nhận tiền khi bán hàng (escrow giải ngân vào ví này). Address phải là một trong những ví đã verified của user.",
            "parameters": {
                "type": "object",
                "properties": {"address": {"type": "string", "description": "Địa chỉ EVM 0x..."}},
                "required": ["address"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_recent_orders",
            "description": "Xem 10 đơn hàng gần nhất của user (mã đơn, sản phẩm, trạng thái, giá).",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


# ── Tool dispatchers — call main-service with the user's JWT ─────────────────
async def _main_request(method: str, path: str, auth: str, json_body: Optional[dict] = None) -> dict:
    """Forward an authenticated request to main-service. Auth is the
    'Bearer xxx' header value passed in by the frontend."""
    if not auth:
        return {"error": "Bạn chưa đăng nhập. Hãy đăng nhập rồi thử lại."}
    url = f"{MAIN_SERVICE_URL}{path}"
    headers = {"Authorization": auth, "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        try:
            res = await client.request(method, url, headers=headers, json=json_body, timeout=10)
            if res.status_code >= 400:
                msg = res.text
                try:
                    msg = res.json().get("message", msg)
                except Exception:
                    pass
                return {"error": f"HTTP {res.status_code}: {msg}"}
            return res.json()
        except Exception as e:
            return {"error": f"Network error: {e}"}


async def _tool_get_my_profile(auth: str, args: dict) -> dict:
    return await _main_request("GET", "/api/users/profile", auth)


async def _tool_update_my_profile(auth: str, args: dict) -> dict:
    # Reject empty updates so the tool doesn't fire for nothing.
    if not any(args.get(k) for k in ("username", "phone", "address_line", "avatar_url", "paypal_email")):
        return {"error": "Không có trường nào để cập nhật."}
    return await _main_request("PUT", "/api/users/profile", auth, args)


async def _tool_list_my_wallets(auth: str, args: dict) -> dict:
    return await _main_request("GET", "/api/wallets", auth)


async def _tool_unlink_wallet(auth: str, args: dict) -> dict:
    wid = args.get("wallet_id")
    if not isinstance(wid, int):
        return {"error": "wallet_id phải là số nguyên (lấy từ list_my_wallets)."}
    return await _main_request("DELETE", f"/api/wallets/{wid}", auth)


async def _tool_set_primary_wallet(auth: str, args: dict) -> dict:
    wid = args.get("wallet_id")
    if not isinstance(wid, int):
        return {"error": "wallet_id phải là số nguyên."}
    return await _main_request("PATCH", f"/api/wallets/{wid}/primary", auth)


async def _tool_set_seller_payout_wallet(auth: str, args: dict) -> dict:
    address = args.get("address")
    if not isinstance(address, str) or not address.startswith("0x") or len(address) != 42:
        return {"error": "address phải là EVM 0x... (40 hex chars)."}
    return await _main_request("PATCH", "/api/seller/payout-wallet", auth, {"address": address})


async def _tool_get_my_recent_orders(auth: str, args: dict) -> dict:
    return await _main_request("GET", "/api/orders?limit=10", auth)


TOOL_DISPATCH = {
    "get_my_profile": _tool_get_my_profile,
    "update_my_profile": _tool_update_my_profile,
    "list_my_wallets": _tool_list_my_wallets,
    "unlink_wallet": _tool_unlink_wallet,
    "set_primary_wallet": _tool_set_primary_wallet,
    "set_seller_payout_wallet": _tool_set_seller_payout_wallet,
    "get_my_recent_orders": _tool_get_my_recent_orders,
}


# ── Context fetchers (unchanged from v1) ─────────────────────────────────────
async def get_crypto_prices(symbols=["BTC", "ETH", "MATIC", "BNB"]):
    try:
        syms = [f'"{s}USDT"' for s in symbols]
        url = f'https://api.binance.com/api/v3/ticker/price?symbols=[{",".join(syms)}]'
        async with httpx.AsyncClient() as client:
            res = await client.get(url, timeout=3)
            data = res.json()
            return {d["symbol"].replace("USDT", ""): float(d["price"]) for d in data}
    except Exception:
        return {}


async def get_featured_products():
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{MAIN_SERVICE_URL}/api/products?limit=5", timeout=3)
            return res.json().get("data", [])
    except Exception:
        return []


def build_context(prices: dict, products: list) -> str:
    ctx = []
    if prices:
        ctx.append("Giá crypto hiện tại: " + ", ".join(f"{k}: ${v:,.2f}" for k, v in prices.items()))
    if products:
        ctx.append("Sản phẩm đang bán: " + ", ".join(
            f"{p.get('name','?')} (${p.get('base_price_usd','?')})"
            for p in products[:5]
        ))
    return "\n".join(ctx)


# ── Groq tool-calling agent loop ─────────────────────────────────────────────
async def call_groq_with_tools(messages: list, system: str, auth: str, max_iters: int = 4) -> dict:
    """Run a tool-calling agent loop on Groq. Each iteration sends the
    conversation, gets back either a final answer (string) or a list of
    tool_calls. We dispatch the tool_calls to main-service and feed the
    results back into the next iteration. Caps at max_iters to prevent
    infinite loops on a model that keeps requesting tools.
    """
    convo = [{"role": "system", "content": system}] + messages

    # Tools are only useful for authenticated users — strip them if no auth so
    # the model doesn't promise actions it can't actually perform.
    tools = TOOLS if auth else None

    last_reply = ""
    for iteration in range(max_iters):
        body: dict = {
            "model": GROQ_MODEL,
            "messages": convo,
            "max_tokens": 800,
            "temperature": 0.6,
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"

        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json=body,
                timeout=30,
            )
            if res.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Groq API error: {res.text}")
            data = res.json()
            choice = data["choices"][0]["message"]
            tool_calls = choice.get("tool_calls") or []
            content = choice.get("content") or ""

            if not tool_calls:
                # Final answer
                return {"reply": content, "iterations": iteration + 1}

            # Append the assistant turn that requested the tool calls
            convo.append({
                "role": "assistant",
                "content": content,
                "tool_calls": tool_calls,
            })

            # Dispatch each tool call and append the tool result turn
            for tc in tool_calls:
                fn_name = tc.get("function", {}).get("name", "")
                fn_args_raw = tc.get("function", {}).get("arguments", "{}")
                try:
                    fn_args = json.loads(fn_args_raw) if isinstance(fn_args_raw, str) else fn_args_raw
                except Exception:
                    fn_args = {}

                logger.info(f"[ai-tool] {fn_name} args={fn_args}")
                handler = TOOL_DISPATCH.get(fn_name)
                if not handler:
                    tool_result = {"error": f"Unknown tool: {fn_name}"}
                else:
                    try:
                        tool_result = await handler(auth, fn_args)
                    except Exception as e:
                        tool_result = {"error": str(e)}

                convo.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", ""),
                    "name": fn_name,
                    "content": json.dumps(tool_result, ensure_ascii=False),
                })
            # Loop back to let the model generate the final answer
        last_reply = content

    return {"reply": last_reply or "Đã chạy quá nhiều bước, hãy thử lại.", "iterations": max_iters}


# ── Other providers (no tool support — old behaviour) ────────────────────────
async def call_groq_simple(messages: list, system: str) -> str:
    payload = [{"role": "system", "content": system}] + messages
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": payload, "max_tokens": 512, "temperature": 0.7},
            timeout=20,
        )
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Groq API error: {res.text}")
        return res.json()["choices"][0]["message"]["content"]


async def call_gemini(messages: list, system: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    contents = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 512, "temperature": 0.7},
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=payload, timeout=20)
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Gemini API error: {res.text}")
        return res.json()["candidates"][0]["content"]["parts"][0]["text"]


async def call_grok(messages: list, system: str) -> str:
    payload = [{"role": "system", "content": system}] + messages
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.x.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROK_API_KEY}", "Content-Type": "application/json"},
            json={"model": GROK_MODEL, "messages": payload, "max_tokens": 512, "temperature": 0.7},
            timeout=25,
        )
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Grok API error: {res.text}")
        return res.json()["choices"][0]["message"]["content"]


async def call_openrouter(messages: list, system: str) -> str:
    models_to_try = [
        OPENROUTER_MODEL,
        "nvidia/nemotron-nano-9b-v2:free",
        "meta-llama/llama-3.2-3b-instruct:free",
    ]
    payload_messages = [{"role": "user", "content": f"[System Instructions]: {system}"}] + messages
    last_err = None
    async with httpx.AsyncClient() as client:
        for model in models_to_try:
            try:
                res = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://kienai.id.vn",
                        "X-Title": "Web3Market AI",
                    },
                    json={"model": model, "messages": payload_messages, "max_tokens": 512, "temperature": 0.7},
                    timeout=25,
                )
                if res.status_code in (200,):
                    data = res.json()
                    if "error" not in data:
                        return data["choices"][0]["message"]["content"]
                last_err = f"{model}: {res.status_code}"
            except Exception as e:
                last_err = f"{model}: {e}"
    raise HTTPException(status_code=502, detail=f"All OpenRouter models failed: {last_err}")


# ── Rule-based fallback (unchanged from v1, trimmed for brevity) ─────────────
async def rule_based_reply(req: ChatRequest, prices: dict, products: list):
    raw = req.messages[-1].content.strip() if req.messages else ""
    last = raw.lower()
    price_info = ", ".join(f"{k}: ${v:,.2f}" for k, v in prices.items()) if prices else "đang tải..."
    if any(w in last for w in ("xin chào", "hello", "hi", "chào")):
        return {"provider": "rule-based", "model": "builtin-v2", "reply": (
            f"Chào bạn! 👋 Tôi là AI trợ lý Web3Market.\n\n📊 Giá crypto: {price_info}\n\n"
            f"Khi đã đăng nhập tôi có thể giúp bạn xem/cập nhật profile, ví, đơn hàng — chỉ cần chat."
        )}
    return {"provider": "rule-based", "model": "builtin-v2", "reply": (
        f"📊 Giá crypto: {price_info}\n\nHỏi tôi về giá coin, sản phẩm, ví, đơn hàng của bạn."
    )}


# ── Main chat endpoint ───────────────────────────────────────────────────────
@app.post("/api/ai/chat")
async def chat(req: ChatRequest, authorization: Optional[str] = Header(default=None)):
    prices, products = await asyncio.gather(get_crypto_prices(), get_featured_products())

    if not PROVIDERS:
        return await rule_based_reply(req, prices, products)

    context = build_context(prices, products)
    system_msg = SYSTEM_PROMPT
    if context:
        system_msg += f"\n\nThông tin hiện tại:\n{context}"
    if req.context:
        system_msg += f"\n{req.context}"
    if authorization:
        system_msg += "\n\n[User đã đăng nhập — bạn có thể dùng các tool để giúp họ thao tác trực tiếp.]"
    else:
        system_msg += "\n\n[User chưa đăng nhập — không có tool nào available, chỉ tư vấn chung.]"

    raw_messages = [m.model_dump(exclude_none=True) for m in req.messages]

    # When the user is authenticated AND Groq is wired up, run the
    # tool-calling agent first — that's the only path that can actually
    # mutate the user's data on their behalf.
    if authorization and TOOL_PROVIDER == "groq":
        try:
            result = await call_groq_with_tools(raw_messages, system_msg, authorization)
            return {"reply": result["reply"], "provider": "groq", "model": GROQ_MODEL,
                    "tool_iterations": result.get("iterations", 1)}
        except Exception as e:
            logger.warning(f"Groq tool-calling failed, falling back to chat cascade: {e}")

    # General chat cascade — Gemini first per user preference, then Groq /
    # OpenRouter / Grok as backups. No tool calling on this path.
    for provider in PROVIDERS:
        if provider == "groq":
            caller = call_groq_simple
        elif provider == "gemini":
            caller = call_gemini
        elif provider == "grok":
            caller = call_grok
        elif provider == "openrouter":
            caller = call_openrouter
        else:
            continue
        try:
            reply = await caller(raw_messages, system_msg)
            model_map = {"groq": GROQ_MODEL, "gemini": GEMINI_MODEL, "grok": GROK_MODEL, "openrouter": OPENROUTER_MODEL}
            return {"reply": reply, "provider": provider, "model": model_map.get(provider, "?")}
        except Exception as e:
            logger.warning(f"Provider {provider} failed: {e}")
            continue

    return await rule_based_reply(req, prices, products)


@app.get("/health")
@app.get("/api/ai/health")
def health():
    return {
        "status": "ok",
        "providers": PROVIDERS,
        "chat_primary": PRIMARY,
        "tool_provider": TOOL_PROVIDER,
        "tools_enabled": TOOL_PROVIDER is not None,
        "tool_count": len(TOOLS),
    }
