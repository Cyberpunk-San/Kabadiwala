# apps/backend/routers/assistant.py
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from db import get_db
from models.domain import AssistantChatRequest, AssistantChatResponse
from services import assistant_service
from services.ai_providers import provider_status

router = APIRouter(prefix="/api/v1/assistant", tags=["AI Assistant"])


@router.post("/chat", response_model=AssistantChatResponse)
async def chat(req: AssistantChatRequest, db: Session = Depends(get_db)):
    """Ask Kabadi Sahayak. Uses free HF / Gemini if configured, else offline answers."""
    return await run_in_threadpool(assistant_service.chat, db, req)


@router.get("/status")
def status():
    return provider_status()
