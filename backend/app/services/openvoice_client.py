# backend/app/services/openvoice_client.py
import httpx


class OpenVoiceClient:
    def __init__(self, base_url: str):
        self._base_url = base_url
        self._client = httpx.AsyncClient(base_url=base_url, timeout=30.0)

    async def clone_voice(self, audio_base64: str, session_id: str) -> bool:
        response = await self._client.post(
            "/clone",
            json={"audio_base64": audio_base64, "session_id": session_id},
        )
        return response.status_code == 200

    async def speak(self, text: str, language: str, session_id: str) -> bytes | None:
        response = await self._client.post(
            "/speak",
            json={
                "text": text,
                "language": language,
                "session_id": session_id,
            },
        )
        if response.status_code == 200:
            return response.content
        return None

    async def health_check(self) -> bool:
        try:
            response = await self._client.get("/health")
            return response.status_code == 200
        except httpx.HTTPError:
            return False

    async def close(self):
        await self._client.aclose()
