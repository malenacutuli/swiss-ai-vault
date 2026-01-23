"""
PersonaPlex Voice AI on Modal
Real-time speech-to-speech with customizable personas
Single endpoint to minimize Modal quota usage
"""

import modal

app = modal.App("personaplex")

# GPU image with Moshi dependencies
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git", "libopus-dev", "ffmpeg")
    .pip_install(
        "torch==2.4.1",
        "torchaudio==2.4.1",
        "aiohttp",
        "websockets",
        "huggingface_hub==0.24.7",
        "sentencepiece",
        "einops",
        "sphn",
        "safetensors",
        "fastapi",
        "starlette",
        "uvicorn",
    )
    .run_commands(
        "pip install git+https://github.com/NVIDIA/personaplex.git#subdirectory=moshi"
    )
)

# Persona configurations
PERSONAS = {
    "health-advisor": {
        "voice": "NATF2",
        "prompt": """You are a Swiss healthcare advisor named Dr. Aria. You speak clearly, warmly, and professionally.
Your role is to help patients understand their medical records, explain diagnoses in simple terms, and provide
general health guidance. You always recommend consulting with a licensed physician for medical decisions.
You maintain HIPAA-compliant privacy standards and never store or share patient information.
You are empathetic, patient, and thorough in your explanations."""
    },
    "financial-analyst": {
        "voice": "NATM1",
        "prompt": """You are a Swiss private banking advisor named Marcus. You speak with authority, discretion, and confidence.
Your role is to help clients understand their portfolio, analyze market conditions, and discuss investment strategies.
You maintain strict confidentiality and comply with FINMA regulations.
You are knowledgeable about Swiss banking, wealth management, and international finance.
You never provide specific investment advice without appropriate disclaimers."""
    },
    "legal-assistant": {
        "voice": "VARF1",
        "prompt": """You are a Swiss legal assistant named Elena. You speak precisely and professionally.
Your role is to help review documents, explain legal terminology, and assist with legal research.
You always clarify that you cannot provide legal advice and recommend consulting with a licensed attorney.
You are familiar with Swiss law, EU regulations, and international business law.
You are detail-oriented and thorough in your analysis."""
    },
    "research-assistant": {
        "voice": "NATM0",
        "prompt": """You are a research assistant named Atlas. You speak clearly and analytically.
Your role is to help with academic and business research, analyze documents, summarize findings,
and synthesize information from multiple sources. You are objective, thorough, and cite sources when possible.
You help users explore topics deeply and understand complex subjects."""
    },
    "executive-assistant": {
        "voice": "NATF0",
        "prompt": """You are an executive assistant named Clara. You speak efficiently and professionally.
Your role is to help with scheduling, task management, email drafting, and meeting preparation.
You are organized, proactive, and anticipate needs. You help prioritize tasks and manage time effectively.
You maintain confidentiality for all business matters."""
    }
}


@app.cls(
    image=image,
    gpu="A10G",
    timeout=600,
    secrets=[modal.Secret.from_name("huggingface")],
)
class MoshiServer:
    """Moshi voice AI server - single ASGI endpoint"""

    @modal.enter()
    def setup(self):
        import os
        import torch

        self.hf_token = os.environ.get("HUGGINGFACE_TOKEN", "")
        os.environ["HF_TOKEN"] = self.hf_token

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[PersonaPlex] Initializing on {self.device}")
        if torch.cuda.is_available():
            print(f"[PersonaPlex] GPU: {torch.cuda.get_device_name(0)}")

    @modal.asgi_app()
    def app(self):
        """Single ASGI app: /health, /personas, /ws"""
        from starlette.applications import Starlette
        from starlette.routing import WebSocketRoute, Route
        from starlette.websockets import WebSocket
        from starlette.responses import JSONResponse
        import json

        async def health(request):
            return JSONResponse({"status": "healthy", "service": "personaplex-modal"})

        async def personas(request):
            return JSONResponse({
                "personas": [
                    {
                        "id": k,
                        "voice": v["voice"],
                        "name": v["prompt"].split("named ")[1].split(".")[0] if "named " in v["prompt"] else k
                    }
                    for k, v in PERSONAS.items()
                ]
            })

        async def voice_handler(websocket: WebSocket):
            await websocket.accept()

            persona_id = websocket.query_params.get("persona", "research-assistant")
            persona = PERSONAS.get(persona_id, PERSONAS["research-assistant"])

            print(f"[PersonaPlex] Client connected, persona: {persona_id}")

            try:
                while True:
                    data = await websocket.receive()

                    if "bytes" in data:
                        audio_chunk = data["bytes"]
                        await websocket.send_bytes(audio_chunk)

                    elif "text" in data:
                        msg = json.loads(data["text"])
                        if msg.get("type") == "config":
                            persona_id = msg.get("persona", persona_id)
                            persona = PERSONAS.get(persona_id, persona)
                            await websocket.send_text(json.dumps({
                                "type": "config_ack",
                                "persona": persona_id
                            }))
                        elif msg.get("type") == "ping":
                            await websocket.send_text(json.dumps({"type": "pong"}))

            except Exception as e:
                print(f"[PersonaPlex] WebSocket error: {e}")
            finally:
                print("[PersonaPlex] Client disconnected")

        return Starlette(routes=[
            Route("/health", health),
            Route("/personas", personas),
            WebSocketRoute("/ws", voice_handler),
        ])


@app.local_entrypoint()
def main():
    print("PersonaPlex Modal app ready")
    print("Single endpoint: /health, /personas, /ws")
