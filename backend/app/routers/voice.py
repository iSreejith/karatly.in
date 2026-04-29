from fastapi import APIRouter
from fastapi.responses import Response, JSONResponse
from app.schemas import VoiceCloneRequest, VoiceSpeakRequest
from app.services.openvoice_client import OpenVoiceClient
from app.config import config

router = APIRouter(prefix="/api/voice", tags=["voice"])

openvoice_client = OpenVoiceClient(base_url=config.OPENVOICE_BASE_URL)


@router.post("/clone")
async def clone_voice(request: VoiceCloneRequest):
    success = await openvoice_client.clone_voice(request.audio_base64, request.session_id)
    return {"success": success}


@router.post("/speak")
async def speak(request: VoiceSpeakRequest):
    audio_bytes = await openvoice_client.speak(request.text, request.language, request.session_id)
    if audio_bytes is None:
        return JSONResponse(status_code=503, content={"detail": "TTS unavailable"})
    return Response(content=audio_bytes, media_type="audio/wav")
