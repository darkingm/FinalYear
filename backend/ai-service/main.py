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
OPENROUTER_MODEL   = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")
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
    """OpenRouter — Free models, OpenAI-compatible API"""
    payload = [{"role": "system", "content": system}] + messages
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://kienai.id.vn",
                "X-Title": "Web3Market AI",
            },
            json={"model": OPENROUTER_MODEL, "messages": payload, "max_tokens": 512, "temperature": 0.7},
            timeout=25,
        )
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"OpenRouter API error: {res.text}")
        return res.json()["choices"][0]["message"]["content"]


# Provider dispatch map
CALLERS = {
    "groq": call_groq,
    "gemini": call_gemini,
    "grok": call_grok,
    "openrouter": call_openrouter,
}


# ── Main chat endpoint ───────────────────────────────────────────────────────
@app.post("/api/ai/chat")
async def chat(req: ChatRequest):
    if not PROVIDERS:
        # No API key — simple rule-based fallback
        last = req.messages[-1].content.lower() if req.messages else ""
        if any(w in last for w in ["giá", "price", "btc", "eth", "bnb"]):
            prices = await get_crypto_prices()
            price_info = ", ".join(f"{k}: ${v:,.2f}" for k, v in prices.items())
            return {"reply": f"Giá crypto hiện tại:\n{price_info}\n\n(Nguồn: Binance realtime)"}
        return {
            "reply": "AI chưa có API key. Cấu hình GROQ_API_KEY, GEMINI_API_KEY hoặc GROK_API_KEY trong .env."
        }

    # Fetch live context (crypto prices + products)
    prices, products = await asyncio.gather(get_crypto_prices(), get_featured_products())
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
            return {
                "reply": reply,
                "provider": provider,
                "model": {"groq": GROQ_MODEL, "gemini": GEMINI_MODEL, "grok": GROK_MODEL}[provider],
            }
        except Exception as e:
            logger.warning(f"Provider {provider} failed: {e}")
            last_error = e
            continue
    # All providers failed — give a helpful fallback instead of 502
    logger.error(f"All AI providers failed. Last: {last_error}")
    # Try to give useful info from context
    if prices:
        price_info = ", ".join(f"{k}: ${v:,.2f}" for k, v in prices.items())
        return {
            "reply": f"Xin lỗi, AI đang tạm thời quá tải. Đây là thông tin giá crypto hiện tại:\n\n{price_info}\n\n📌 Bạn có thể hỏi lại sau ít phút.",
            "provider": "fallback",
            "model": "rule-based",
        }
    return {
        "reply": "Xin lỗi, hệ thống AI đang bảo trì. Vui lòng thử lại sau ít phút hoặc liên hệ hỗ trợ. 🙏",
        "provider": "fallback",
        "model": "rule-based",
    }


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
