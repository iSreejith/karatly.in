import json
import httpx

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


def _check_status(response: httpx.Response) -> None:
    """Raise for HTTP error status, compatible with mocked responses."""
    if response.status_code >= 400:
        if response.request is not None:
            response.raise_for_status()
        else:
            raise httpx.HTTPStatusError(
                f"HTTP {response.status_code}",
                request=httpx.Request("POST", "/"),
                response=response,
            )


class OllamaClient:
    def __init__(self, base_url: str, model: str):
        self._base_url = base_url
        self._model = model
        self._client = httpx.AsyncClient(base_url=base_url, timeout=60.0)

    async def chat(self, system_prompt: str, messages: list[dict]) -> str:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                *messages,
            ],
            "stream": False,
        }
        response = await self._client.post("/api/chat", json=payload)
        _check_status(response)
        return response.json()["message"]["content"]

    async def analyze_face(self, image_base64: str) -> dict | None:
        payload = {
            "model": self._model,
            "messages": [
                {
                    "role": "user",
                    "content": FACE_ANALYSIS_PROMPT,
                    "images": [image_base64],
                }
            ],
            "stream": False,
        }
        response = await self._client.post("/api/chat", json=payload)
        _check_status(response)
        content = response.json()["message"]["content"]
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])
            return None

    async def analyze_persona(self, messages: list[dict], analysis_prompt: str) -> dict:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": analysis_prompt},
                *messages,
            ],
            "stream": False,
        }
        response = await self._client.post("/api/chat", json=payload)
        _check_status(response)
        content = response.json()["message"]["content"]
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])
            return {}

    async def health_check(self) -> bool:
        try:
            response = await self._client.get("/")
            return response.status_code == 200
        except httpx.HTTPError:
            return False

    async def close(self):
        await self._client.aclose()
