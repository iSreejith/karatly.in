# backend/app/services/gemini_client.py
import json
import base64
from app.config import config

FACE_ANALYSIS_PROMPT = """Analyze this person's face and return ONLY valid JSON with these exact fields:
- skin_color: hex color string (e.g. "#D2A67D")
- hair_color: hex color string
- hair_style: one of "short_straight", "short_wavy", "short_curly", "medium_straight", "medium_wavy", "medium_curly", "long_straight", "long_wavy", "long_curly", "bald"
- eye_color: hex color string
- face_shape: one of "oval", "round", "square", "heart", "oblong"
- has_glasses: boolean
- has_facial_hair: boolean
- age_range: string like "20-30"
Return ONLY the JSON, no other text."""


class GeminiClient:
    def __init__(self):
        self._api_key = config.GEMINI_API_KEY
        self._model = config.GEMINI_MODEL

    def is_available(self) -> bool:
        return bool(self._api_key)

    async def analyze_face(self, image_base64: str) -> dict | None:
        if not self.is_available():
            return None
        try:
            from google import genai

            client = genai.Client(api_key=self._api_key)
            image_bytes = base64.b64decode(image_base64)
            response = client.models.generate_content(
                model=self._model,
                contents=[
                    {
                        "parts": [
                            {"text": FACE_ANALYSIS_PROMPT},
                            {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(image_bytes).decode()}},
                        ]
                    }
                ],
            )
            content = response.text
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                start = content.find("{")
                end = content.rfind("}") + 1
                if start >= 0 and end > start:
                    return json.loads(content[start:end])
                return None
        except Exception:
            return None
