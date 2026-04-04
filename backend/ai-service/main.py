from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
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
GROQ_MODEL        = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL      = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GROK_API_KEY      = os.getenv("GROK_API_KEY", "")
GROK_MODEL        = os.getenv("GROK_MODEL", "grok-3-mini-fast")
# OpenRouter: free models, no credit card needed (sign up at openrouter.ai)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL   = os.getenv("OPENROUTER_MODEL", "google/gemma-3-12b-it:free")
MAIN_SERVICE_URL  = os.getenv("MAIN_SERVICE_URL", "http://main-service:3001")

# Determine active provider chain
# Priority: GROQ (fastest) → Gemini → OpenRouter (free) → Grok
PROVIDERS: list[str] = []
if GROQ_API_KEY:
    PROVIDERS.append("groq")
if GEMINI_API_KEY:
    PROVIDERS.append("gemini")
if OPENROUTER_API_KEY:
    PROVIDERS.append("openrouter")
if GROK_API_KEY:
    PROVIDERS.append("grok")

PRIMARY = PROVIDERS[0] if PROVIDERS else "none"
logger.info(f"AI providers available: {PROVIDERS}, primary: {PRIMARY}")

SYSTEM_PROMPT = """Bạn là AI Assistant của CryptoMarket - sàn thương mại điện tử Web3.

Nhiệm vụ của bạn:
1. Giải đáp thắc mắc về giá coin và thị trường crypto
2. Gợi ý sản phẩm phù hợp với nhu cầu người dùng
3. Hướng dẫn quy trình mua hàng, thanh toán bằng crypto
4. Giải thích Smart Contract Escrow, bảo vệ giao dịch
5. Hỗ trợ kết nối ví MetaMask và các ví Web3
6. Giải thích RWA (Real World Assets) token hóa tài sản thực

Luôn trả lời thân thiện, ngắn gọn và chính xác.
Nếu không biết thông tin cụ thể về giá, hãy nói rõ là cần kiểm tra thời gian thực.
Nếu được hỏi ngoài phạm vi crypto/marketplace, từ chối nhẹ nhàng."""


class ChatMessage(BaseModel):
    role: str  # user | assistant | system
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_id: Optional[str] = None


# ── Context fetchers ─────────────────────────────────────────────────────────
async def get_crypto_prices(symbols=["BTC", "ETH", "MATIC", "BNB"]):
    try:
        syms = [f'"{s}USDT"' for s in symbols]
        url = f'https://api.binance.com/api/v3/ticker/price?symbols=[{",".join(syms)}]'
        async with httpx.AsyncClient() as client:
            res = await client.get(url, timeout=3)
            data = res.json()
            return {d["symbol"].replace("USDT", ""): float(d["price"]) for d in data}
    except:
        return {}


async def get_featured_products():
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{MAIN_SERVICE_URL}/api/products?limit=5", timeout=3)
            return res.json().get("data", [])
    except:
        return []


def build_context(prices: dict, products: list) -> str:
    ctx = []
    if prices:
        ctx.append("Giá crypto hiện tại: " + ", ".join(f"{k}: ${v:,.2f}" for k, v in prices.items()))
    if products:
        ctx.append("Sản phẩm đang bán: " + ", ".join(
            f"{p.get('name','?')} ({p.get('token_symbol','USD')}: {p.get('price_in_token') or p.get('base_price_usd','?')})"
            for p in products[:5]
        ))
    return "\n".join(ctx)


# ── Provider implementations ─────────────────────────────────────────────────

async def call_groq(messages: list, system: str) -> str:
    """Groq — OpenAI-compatible API, fastest inference"""
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
    """Google Gemini via REST API (no SDK needed)"""
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
        data = res.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def call_grok(messages: list, system: str) -> str:
    """xAI Grok — OpenAI-compatible API"""
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
    """OpenRouter — Free models with fallback rotation"""
    # Models to try in order (all free)
    models_to_try = [
        OPENROUTER_MODEL,
        "nvidia/nemotron-nano-9b-v2:free",
        "meta-llama/llama-3.2-3b-instruct:free",
    ]
    # Inject system prompt as first user message for broader model compatibility
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
                    json={
                        "model": model,
                        "messages": payload_messages,
                        "max_tokens": 512,
                        "temperature": 0.7,
                    },
                    timeout=25,
                )
                if res.status_code == 429:
                    logger.warning(f"OpenRouter {model} rate-limited, trying next...")
                    continue
                if res.status_code != 200:
                    logger.warning(f"OpenRouter {model} error {res.status_code}: {res.text[:200]}")
                    last_err = f"OpenRouter {model}: {res.status_code}"
                    continue
                data = res.json()
                if "error" in data:
                    logger.warning(f"OpenRouter {model} data error: {data['error']}")
                    last_err = f"OpenRouter {model}: {data['error']}"
                    continue
                content = data["choices"][0]["message"]["content"]
                logger.info(f"OpenRouter success with model: {model}")
                return content
            except Exception as e:
                logger.warning(f"OpenRouter {model} exception: {e}")
                last_err = str(e)
                continue
    raise HTTPException(status_code=502, detail=f"All OpenRouter models failed: {last_err}")


# Provider dispatch map
CALLERS = {
    "groq": call_groq,
    "gemini": call_gemini,
    "grok": call_grok,
    "openrouter": call_openrouter,
}


# ── Vietnamese diacritics removal for fuzzy matching ──────────────────────────
_VN_MAP = str.maketrans(
    "àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ"
    "ÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ",
    "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd"
    "AAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD"
)
def _norm(s: str) -> str:
    """Remove Vietnamese diacritics for fuzzy keyword matching."""
    return s.translate(_VN_MAP).lower().strip()


# ── Smart rule-based fallback (no API key needed) ────────────────────────────
async def rule_based_reply(req, prices: dict, products: list):
    """Comprehensive keyword-based responses using live Binance data."""
    raw = req.messages[-1].content.strip() if req.messages else ""
    last = raw.lower()
    norm = _norm(raw)  # diacritics-free version for matching
    result = {"provider": "rule-based", "model": "builtin-v2"}

    def _match(*keywords):
        """Match keywords against both original and diacritics-stripped text.
        Uses word boundary check for short keywords (<=3 chars) to avoid false positives."""
        for w in keywords:
            if len(w) <= 3:
                # Short keywords: check as whole word
                for text in [last, norm]:
                    words = text.split()
                    if w in words:
                        return True
            else:
                if w in last or w in norm:
                    return True
        return False

    # ── Greeting ──
    if _match("xin chao", "hello", "hey", "chao", "xin chào", "chào"):
        price_info = ", ".join(f"{k}: ${v:,.2f}" for k, v in prices.items()) if prices else ""
        result["reply"] = (
            f"Chào bạn! 👋 Tôi là AI trợ lý của Web3Market.\n\n"
            f"📊 Giá crypto realtime: {price_info}\n\n"
            f"Bạn có thể hỏi tôi về:\n"
            f"• Giá BTC, ETH, BNB, MATIC\n"
            f"• Cách mua hàng & thanh toán crypto\n"
            f"• Cách kết nối ví MetaMask\n"
            f"• Phí giao dịch & escrow\n"
            f"• Trạng thái đơn hàng"
        )
        return result

    # ── Price queries ──
    if _match("gia", "giá", "price", "bao nhieu", "bao nhiêu", "how much"):
        coins_mentioned = [k for k in ["BTC", "ETH", "BNB", "MATIC"] if k.lower() in last]
        if not coins_mentioned:
            coins_mentioned = list(prices.keys()) if prices else []

        if prices and coins_mentioned:
            lines = []
            for c in coins_mentioned:
                if c in prices:
                    lines.append(f"💰 {c}: **${prices[c]:,.2f}**")
            result["reply"] = "\n".join(lines) + "\n\n📡 Nguồn: Binance realtime\n🔄 Xem biểu đồ: kienai.id.vn/trading/BTCUSDT"
        else:
            result["reply"] = "Không lấy được giá. Vui lòng thử lại sau."
        return result

    # ── Products ──
    if _match("san pham", "sản phẩm", "product", "mua gi", "mua gì", "hang", "hàng", "shop", "cua hang"):
        if products:
            items = "\n".join(f"• {p.get('name', 'N/A')} — ${p.get('price', 0):,.2f}" for p in products[:5])
            result["reply"] = f"🛍️ Sản phẩm nổi bật:\n{items}\n\n👉 Xem thêm tại kienai.id.vn/products"
        else:
            result["reply"] = "🛍️ Xem sản phẩm tại kienai.id.vn/products"
        return result

    # ── Payment / checkout ──
    if _match("thanh toan", "thanh toán", "payment", "pay", "checkout", "mua hang", "dat hang", "đặt hàng"):
        result["reply"] = (
            "💳 **Hướng dẫn thanh toán crypto:**\n\n"
            "1. Chọn sản phẩm → Thêm vào giỏ hàng\n"
            "2. Nhấn Thanh toán → Chọn mạng (Polygon, BSC)\n"
            "3. Kết nối ví MetaMask\n"
            "4. Xác nhận giao dịch trên ví\n"
            "5. Tiền vào Escrow → Nhận hàng → Xác nhận → Seller nhận tiền\n\n"
            "🔒 An toàn: Smart Contract Escrow giữ tiền cho đến khi bạn xác nhận nhận hàng."
        )
        return result

    # ── Wallet / MetaMask ──
    if _match("wallet", "metamask", "ket noi", "kết nối", "connect", "ket noi vi", "kết nối ví"):
        result["reply"] = (
            "🦊 **Kết nối ví MetaMask:**\n\n"
            "1. Cài MetaMask extension (Chrome/Firefox)\n"
            "2. Tạo ví hoặc import seed phrase\n"
            "3. Vào kienai.id.vn → Nhấn nút 'Login' → Chọn MetaMask\n"
            "4. Duyệt kết nối trên MetaMask popup\n\n"
            "⚠️ Không chia sẻ seed phrase với bất kỳ ai!"
        )
        return result

    # ── Fees / escrow ──
    if _match("phi giao dich", "phí", "fee", "escrow", "hoa hong", "commission", "gas fee"):
        result["reply"] = (
            "💡 **Phí giao dịch Web3Market:**\n\n"
            "• Phí sàn: 1% mỗi giao dịch\n"
            "• Gas fee: tùy mạng (Polygon ~$0.01, BSC ~$0.1)\n"
            "• Escrow: Miễn phí (Smart Contract tự động)\n\n"
            "🔒 Escrow giữ tiền an toàn cho đến khi buyer xác nhận nhận hàng."
        )
        return result

    # ── Trading ──
    if _match("trade", "trading", "giao dich", "giao dịch", "exchange", "swap"):
        result["reply"] = (
            "📈 **Giao dịch trên Web3Market:**\n\n"
            "• Spot Trading: Mua/Bán crypto theo giá thị trường\n"
            "• Swap: Đổi token nhanh (USDT ↔ BTC, ETH...)\n"
            "• Chart: Biểu đồ TradingView realtime\n\n"
            "👉 Truy cập: kienai.id.vn/trading/BTCUSDT"
        )
        return result

    # ── Order status ──
    if _match("don hang", "đơn hàng", "order", "trang thai", "trạng thái", "status", "theo doi"):
        result["reply"] = (
            "📦 **Theo dõi đơn hàng:**\n\n"
            "1. Đăng nhập vào tài khoản\n"
            "2. Vào Profile → Đơn hàng của tôi\n"
            "3. Xem trạng thái: Pending → Paid → Shipped → Delivered\n\n"
            "Hoặc truy cập: kienai.id.vn/orders"
        )
        return result

    # ── Security ──
    if _match("bao mat", "bảo mật", "security", "an toan", "an toàn", "lua dao", "scam"):
        result["reply"] = (
            "🔐 **Bảo mật trên Web3Market:**\n\n"
            "• Smart Contract Escrow: Tiền được giữ an toàn\n"
            "• NFT Receipt: Mỗi giao dịch có NFT chứng nhận\n"
            "• AI Credit Score (SBT): Đánh giá uy tín user\n"
            "• Không lưu private key của bạn\n\n"
            "⚠️ Tips: Luôn kiểm tra address trước khi giao dịch!"
        )
        return result

    # ── Default: show prices + help ──
    price_info = ", ".join(f"{k}: ${v:,.2f}" for k, v in prices.items()) if prices else "đang tải..."
    result["reply"] = (
        f"📊 Giá crypto realtime: {price_info}\n\n"
        f"Tôi có thể giúp bạn:\n"
        f"• Xem giá crypto (hỏi 'giá BTC')\n"
        f"• Hướng dẫn mua hàng & thanh toán\n"
        f"• Kết nối ví MetaMask\n"
        f"• Thông tin phí & escrow\n"
        f"• Theo dõi đơn hàng\n\n"
        f"💬 Hãy hỏi tôi bất cứ điều gì!"
    )
    return result


# ── Main chat endpoint ───────────────────────────────────────────────────────
@app.post("/api/ai/chat")
async def chat(req: ChatRequest):
    # Fetch live context regardless of provider availability
    prices, products = await asyncio.gather(get_crypto_prices(), get_featured_products())

    if not PROVIDERS:
        # No API key — smart rule-based fallback with live data
        return await rule_based_reply(req, prices, products)

    context = build_context(prices, products)

    system_msg = SYSTEM_PROMPT
    if context:
        system_msg += f"\n\nThông tin hiện tại:\n{context}"

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    # Try all providers in order until one succeeds
    last_error = None
    for provider in PROVIDERS:
        try:
            logger.info(f"Trying provider: {provider}")
            reply = await CALLERS[provider](messages, system_msg)
            model_map = {"groq": GROQ_MODEL, "gemini": GEMINI_MODEL, "grok": GROK_MODEL, "openrouter": OPENROUTER_MODEL}
            return {
                "reply": reply,
                "provider": provider,
                "model": model_map.get(provider, "unknown"),
            }
        except Exception as e:
            logger.warning(f"Provider {provider} failed: {e}")
            last_error = e
            continue
    # All providers failed — use smart rule-based fallback
    logger.error(f"All AI providers failed. Last: {last_error}")
    return await rule_based_reply(req, prices, products)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "providers": PROVIDERS,
        "primary": PRIMARY,
        "models": {
            "groq": GROQ_MODEL if GROQ_API_KEY else None,
            "gemini": GEMINI_MODEL if GEMINI_API_KEY else None,
            "grok": GROK_MODEL if GROK_API_KEY else None,
            "openrouter": OPENROUTER_MODEL if OPENROUTER_API_KEY else None,
        },
    }
