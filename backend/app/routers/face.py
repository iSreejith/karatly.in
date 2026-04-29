from fastapi import APIRouter, HTTPException
from app.schemas import FaceAnalysisRequest, FaceAnalysisResponse, AvatarConfig
from app.services.ollama_client import OllamaClient
from app.services.gemini_client import GeminiClient
from app.config import config

router = APIRouter(prefix="/api/face", tags=["face"])

ollama_client = OllamaClient(base_url=config.OLLAMA_BASE_URL, model=config.OLLAMA_MODEL)
gemini_client = GeminiClient()


@router.post("/analyze", response_model=FaceAnalysisResponse)
async def analyze_face(request: FaceAnalysisRequest):
    result = await ollama_client.analyze_face(request.image_base64)

    if result is None:
        result = await gemini_client.analyze_face(request.image_base64)

    if result is None:
        raise HTTPException(status_code=500, detail="Face analysis failed on all providers")

    avatar_config = AvatarConfig(
        skin_color=result.get("skin_color", "#D2A67D"),
        hair_color=result.get("hair_color", "#3B2417"),
        hair_style=result.get("hair_style", "short_wavy"),
        eye_color=result.get("eye_color", "#5B4C3A"),
        face_shape=result.get("face_shape", "oval"),
        has_glasses=result.get("has_glasses", False),
        has_facial_hair=result.get("has_facial_hair", False),
        age_range=result.get("age_range", "adult"),
    )

    return FaceAnalysisResponse(
        avatar_config=avatar_config,
        raw_description=str(result),
    )
