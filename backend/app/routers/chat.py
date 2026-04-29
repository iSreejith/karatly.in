import json
import re
from fastapi import APIRouter
from pydantic import BaseModel
from app.schemas import ChatRequest, ChatResponse
from app.services.ollama_client import OllamaClient
from app.services.persona import PersonaManager
from app.config import config

router = APIRouter(prefix="/api/chat", tags=["chat"])

ollama_client = OllamaClient(base_url=config.OLLAMA_BASE_URL, model=config.OLLAMA_MODEL)
persona_manager = PersonaManager()


class ChatStartRequest(BaseModel):
    language: str = "en"


class ChatStartResponse(BaseModel):
    session_id: str
    text: str
    emotion: str = "friendly"


def parse_emotion(raw_text: str) -> tuple[str, str]:
    """Extract emotion JSON tag from response text. Returns (clean_text, emotion)."""
    match = re.search(r'\{"emotion":\s*"(\w+)"\}', raw_text)
    if match:
        emotion = match.group(1)
        clean_text = raw_text[: match.start()].strip()
        return clean_text, emotion
    return raw_text.strip(), "neutral"


@router.post("/start", response_model=ChatStartResponse)
async def chat_start(request: ChatStartRequest):
    session_id = persona_manager.create_session(request.language)
    system_prompt = persona_manager.build_system_prompt(session_id)

    greeting_prompt = [{"role": "user", "content": f"[System: The user just appeared. Greet them warmly in {request.language}. This is a voice conversation — be brief and natural.]"}]
    raw_response = await ollama_client.chat(system_prompt, greeting_prompt)
    text, emotion = parse_emotion(raw_response)

    persona_manager.add_message(session_id, "assistant", text)

    return ChatStartResponse(session_id=session_id, text=text, emotion=emotion)


@router.post("", response_model=ChatStartResponse)
async def chat(request: ChatRequest):
    session_id = request.session_id

    if not session_id or persona_manager.get_state(session_id) is None:
        session_id = persona_manager.create_session(request.language)

    persona_manager.add_message(session_id, "user", request.text)

    # Check if we should analyze persona (every 5 messages)
    if persona_manager.should_analyze_persona(session_id):
        try:
            analysis = await ollama_client.analyze_persona(
                messages=persona_manager.get_history(session_id),
                analysis_prompt=persona_manager.get_analysis_prompt(),
            )
            if analysis:
                persona_manager.update_persona(
                    session_id,
                    tone=analysis.get("tone", "friendly"),
                    humor_level=analysis.get("humor_level", 0.5),
                    conversation_style=analysis.get("conversation_style", "casual"),
                )
                for interest in analysis.get("new_interests", []):
                    persona_manager.add_interest(session_id, interest)
                for key, value in analysis.get("user_facts", {}).items():
                    persona_manager.update_user_profile(session_id, **{key: value})
        except Exception:
            pass  # Non-critical — continue with current persona

    system_prompt = persona_manager.build_system_prompt(session_id)
    history = persona_manager.get_history(session_id)
    raw_response = await ollama_client.chat(system_prompt, history)
    text, emotion = parse_emotion(raw_response)

    persona_manager.add_message(session_id, "assistant", text)

    return ChatStartResponse(session_id=session_id, text=text, emotion=emotion)
