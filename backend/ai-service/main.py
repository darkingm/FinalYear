from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import httpx
import os
import json

app = FastAPI(title="CryptoMarket AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")  # Free, fast
MAIN_SERVICE_URL = os.getenv("MAIN_SERVICE_URL", "http://main-service:3001")

SYSTEM_PROMPT = """Bạn là AI Assistant của CryptoMarket - sàn thương mại điện tử Web3.

Nhiệm vụ của bạn:
1. Giải đáp thắc mắc về giá coin và thị trường crypto
2. Gợi ý sản phẩm phù hợp với nhu cầu người dùng
3. Hướng dẫn quy trình mua hàng, thanh toán bằng crypto
4. Giải thích Smart Contract Escrow, bảo vệ giao dịch
5. Hỗ trợ kết nối ví MetaMask và các ví Web3

Luôn trả lời thân thiện, ngắn gọn và chính xác. 
Nếu không biết thông tin cụ thể về giá, hãy nói rõ là cần kiểm tra thời gian thực.
Nếu được hỏi ngoài phạm vi crypto/marketplace, từ chối nhẹ nhàng."""


class ChatMessage(BaseModel):
    role: str  # user | assistant | system
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_id: Optional[str] = None


async def get_crypto_prices(symbols=["BTC", "ETH", "MATIC"]):
    """Fetch real-time prices from Binance"""
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
    """Fetch products from main-service"""
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{MAIN_SERVICE_URL}/api/products?limit=5", timeout=3)
            return res.json().get("data", [])
    except:
        return []


def build_context(prices: dict, products: list) -> str:
    ctx_parts = []
    if prices:
        price_str = ", ".join([f"{k}: ${v:,.2f}" for k, v in prices.items()])
        ctx_parts.append(f"Giá crypto hiện tại: {price_str}")
    if products:
        prod_str = ", ".join([
            f"{p.get('name','?')} ({p.get('token_symbol') or 'USD'}: {p.get('price_in_token') or p.get('base_price_usd','?')})"
            for p in products[:5]
        ])
        ctx_parts.append(f"Sản phẩm đang bán: {prod_str}")
    return "\n".join(ctx_parts)


@app.post("/api/ai/chat")
async def chat(req: ChatRequest):
    if not GROQ_API_KEY:
        # Fallback: simple rule-based replies when no API key
        last = req.messages[-1].content.lower() if req.messages else ""
        if any(w in last for w in ["giá", "price", "btc", "eth", "matic"]):
            prices = await get_crypto_prices()
            price_info = ", ".join([f"{k}: ${v:,.2f}" for k, v in prices.items()])
            return {"reply": f"Giá crypto hiện tại:\n{price_info}\n\n(Cập nhật thời gian thực từ Binance)"}
        return {"reply": "Tôi đang cần GROQ_API_KEY để hoạt động đầy đủ. Vui lòng cấu hình biến môi trường GROQ_API_KEY."}

    # Fetch context
    prices, products = await asyncio.gather(
        get_crypto_prices(),
        get_featured_products()
    )
    context = build_context(prices, products)

    system_msg = SYSTEM_PROMPT
    if context:
        system_msg += f"\n\nThông tin hiện tại:\n{context}"

    messages = [{"role": "system", "content": system_msg}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": messages, "max_tokens": 512, "temperature": 0.7},
            timeout=20,
        )
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="Groq API error")
        data = res.json()
        reply = data["choices"][0]["message"]["content"]
        return {"reply": reply}


@app.get("/health")
def health():
    return {"status": "ok", "model": GROQ_MODEL}


import asyncio
