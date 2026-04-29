# backend/app/schemas.py
from pydantic import BaseModel


class AvatarConfig(BaseModel):
    skin_color: str
    hair_color: str
    hair_style: str
    eye_color: str
    face_shape: str = "oval"
    has_glasses: bool = False
    has_facial_hair: bool = False
    age_range: str = "adult"


class PersonaState(BaseModel):
    tone: str = "friendly"
    interests_discovered: list[str] = []
    user_profile: dict[str, str] = {}
    conversation_style: str = "casual"
    humor_level: float = 0.5
    language: str = "en"


class FaceAnalysisRequest(BaseModel):
    image_base64: str


class FaceAnalysisResponse(BaseModel):
    avatar_config: AvatarConfig
    raw_description: str


class ChatRequest(BaseModel):
    text: str
    language: str = "en"
    session_id: str = ""


class ChatResponse(BaseModel):
    text: str
    emotion: str = "neutral"


class VoiceCloneRequest(BaseModel):
    audio_base64: str
    session_id: str


class VoiceSpeakRequest(BaseModel):
    text: str
    language: str = "en"
    session_id: str = ""
