#!/usr/bin/env python3
"""
Aero-Sea Sentinel — Local AI Service
Bridges FastAPI ↔ Ollama (Llama 3 8B / DeepSeek)
Zero external API keys. All inference runs locally.

Usage:
  1. Install Ollama: curl -fsSL https://ollama.ai/install.sh | sh
  2. Pull model:    ollama pull llama3:8b
  3. Start service: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
import os
import json
import time
import asyncio
from typing import AsyncIterator, Optional, Any
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

OLLAMA_HOST  = os.getenv("OLLAMA_HOST",  "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:8b")
# Fallback model list in priority order (prefer smaller/faster)
FALLBACK_MODELS = ["phi3", "phi3:mini", "mistral:7b", "llama3:8b", "llama3", "deepseek-r1:7b", "llama2:7b"]

# ─────────────────────────────────────────────────────────────
# SYSTEM PROMPT — knows everything about the platform
# ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT_TEMPLATE = """You are SENTINEL AI, the built-in intelligence assistant for the Aero-Sea Sentinel platform — a next-generation maritime and aviation fuel optimisation system.

## Your Knowledge Base

### Platform Overview
Aero-Sea Sentinel combines three breakthrough technologies:
1. **Smart Skin** — micro-actuator panels on vessel hulls/fuselages that continuously adjust surface texture to minimise hydrodynamic/aerodynamic drag in real time.
2. **Quantum Compass** — quantum processor-based navigation that calculates optimal routes accounting for ocean currents, weather systems, and jet streams simultaneously.
3. **Eagle Eye LiDAR** — 360° laser radar providing real-time obstacle detection, weather scanning, and environmental data fusion.
4. **Quantum Swarm Algorithm** — multi-vessel AI coordination that optimises fleet-wide routing, not just individual vessels.

### Savings Data (as of current deployment)
- **Ships**: Target €500,000/year per vessel (€40,000+/month)
- **Aircraft**: Target €1,200,000/year per aircraft (€100,000+/month)
- **Case Study — MV Shanghai Express (Shanghai → LA)**: €41,250/month fuel savings, 17.2% drag reduction, 1,980 Smart Skin panels
- **Case Study — AS Horizon Eagle**: €102,400/month, 18.4% drag reduction, projected €1.228M/year (2.4% above target)
- Fleet-wide CO₂ reduction: ~1,240 tonnes/month

### User Roles
- **ADMIN**: Full system control, server nodes, override protocols
- **FLEET MANAGER**: Logistics map, fleet profitability, route approvals
- **ANALYST**: Financial projections, drag efficiency charts, historical trends
- **SENIOR OPERATOR**: Multi-vessel oversight, approves Quantum Swarm route changes
- **OPERATOR**: Tactical cockpit — Quantum Compass, Eagle Eye LiDAR, Smart Skin controls

## Live Fleet Data (injected at query time)
{context_json}

## Your Role
- Answer questions about fleet performance, savings, fuel consumption, drag efficiency
- Provide data-driven insights using the live context above
- Be concise and precise — operators are on the bridge, they need fast answers
- Use € for costs, knots for speed, metric tonnes for CO₂
- Current user role: {user_role}

Keep responses under 150 words unless detailed analysis is requested. Be direct and factual."""

# ─────────────────────────────────────────────────────────────
# Request/Response Models
# ─────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None
    user_role: Optional[str] = "OPERATOR"
    session_id: Optional[str] = "default"
    conversation_history: Optional[list] = []

class ChatResponse(BaseModel):
    response: str
    model: str
    tokens_used: Optional[int] = None
    response_ms: int

# ─────────────────────────────────────────────────────────────
# Ollama client helpers
# ─────────────────────────────────────────────────────────────
async def get_active_model() -> str:
    """Check which models are available in Ollama and return best match."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.get(f"{OLLAMA_HOST}/api/tags")
            if res.status_code == 200:
                available = {m["name"].split(":")[0] for m in res.json().get("models", [])}
                for model in FALLBACK_MODELS:
                    base = model.split(":")[0]
                    if base in available:
                        return model
    except Exception:
        pass
    return OLLAMA_MODEL  # fallback to configured default


def build_messages(request: ChatRequest) -> list[dict]:
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        context_json=json.dumps(request.context or {}, indent=2),
        user_role=request.user_role or "OPERATOR",
    )
    messages = [{"role": "system", "content": system_prompt}]

    # Include recent conversation history (last 6 turns for context window)
    for turn in (request.conversation_history or [])[-6:]:
        messages.append({"role": turn["role"], "content": turn["content"]})

    messages.append({"role": "user", "content": request.message})
    return messages


async def call_ollama(messages: list[dict], model: str, stream: bool = False) -> Any:
    """Call Ollama /api/chat endpoint."""
    payload = {
        "model": model,
        "messages": messages,
        "stream": stream,
        "options": {
            "temperature": 0.3,      # deterministic for factual answers
            "num_predict": 512,      # max tokens
            "top_p": 0.9,
            "repeat_penalty": 1.1,
        },
    }
    timeout = httpx.Timeout(120.0, connect=10.0)
    if stream:
        return httpx.AsyncClient(timeout=timeout).stream(
            "POST", f"{OLLAMA_HOST}/api/chat",
            json=payload, headers={"Content-Type": "application/json"}
        )
    else:
        async with httpx.AsyncClient(timeout=timeout) as client:
            return await client.post(
                f"{OLLAMA_HOST}/api/chat",
                json=payload,
                headers={"Content-Type": "application/json"}
            )

# ─────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    model = await get_active_model()
    print(f"[SENTINEL AI] Service ready | Ollama: {OLLAMA_HOST} | Model: {model}")
    app.state.model = model
    yield

app = FastAPI(title="Sentinel AI Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            res = await client.get(f"{OLLAMA_HOST}/api/tags")
            ollama_ok = res.status_code == 200
    except Exception:
        ollama_ok = False
    return {
        "status": "ok" if ollama_ok else "degraded",
        "ollama": "connected" if ollama_ok else "unreachable",
        "model": getattr(app.state, "model", OLLAMA_MODEL),
    }

@app.get("/models")
async def list_models():
    """List all locally available models."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.get(f"{OLLAMA_HOST}/api/tags")
            return res.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

# ─── Non-streaming chat ──────────────────────────────────────
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    model = getattr(app.state, "model", OLLAMA_MODEL)
    messages = build_messages(request)
    start = time.time()

    try:
        res = await call_ollama(messages, model, stream=False)
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Ollama error: {res.text}")

        data = res.json()
        response_text = data["message"]["content"]
        tokens = data.get("eval_count", 0) + data.get("prompt_eval_count", 0)
        ms = int((time.time() - start) * 1000)

        return ChatResponse(
            response=response_text,
            model=model,
            tokens_used=tokens,
            response_ms=ms,
        )
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama not running. Start with: ollama serve")


# ─── Streaming chat (SSE) ─────────────────────────────────────
@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    model = getattr(app.state, "model", OLLAMA_MODEL)
    messages = build_messages(request)

    async def token_generator() -> AsyncIterator[str]:
        try:
            async with await call_ollama(messages, model, stream=True) as response:
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        if token:
                            yield token
                        if chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue
        except httpx.ConnectError:
            yield "\n[AI service unavailable — ensure Ollama is running]"

    return StreamingResponse(token_generator(), media_type="text/plain")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
