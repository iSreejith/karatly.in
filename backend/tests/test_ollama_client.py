import pytest
import httpx
from unittest.mock import AsyncMock, patch
from app.services.ollama_client import OllamaClient


@pytest.fixture
def ollama():
    return OllamaClient(base_url="http://test:11434", model="gemma4")


@pytest.mark.asyncio
async def test_chat_sends_correct_payload(ollama):
    mock_response = httpx.Response(
        200,
        json={"message": {"content": 'Great to meet you! {"emotion": "friendly"}'}},
    )
    with patch.object(ollama._client, "post", new_callable=AsyncMock, return_value=mock_response):
        result = await ollama.chat(
            system_prompt="You are helpful.",
            messages=[{"role": "user", "content": "Hi"}],
        )
        assert "Great to meet you" in result


@pytest.mark.asyncio
async def test_analyze_face_sends_image(ollama):
    mock_response = httpx.Response(
        200,
        json={
            "message": {
                "content": '{"skin_color": "#D2A67D", "hair_color": "#3B2417", "hair_style": "short_wavy", "eye_color": "#5B4C3A", "face_shape": "oval", "has_glasses": false, "has_facial_hair": false, "age_range": "25-35"}'
            }
        },
    )
    with patch.object(ollama._client, "post", new_callable=AsyncMock, return_value=mock_response):
        result = await ollama.analyze_face("base64imagedata")
        assert result is not None
        assert "skin_color" in result


@pytest.mark.asyncio
async def test_analyze_persona_returns_json(ollama):
    mock_response = httpx.Response(
        200,
        json={
            "message": {
                "content": '{"tone": "playful", "humor_level": 0.7, "conversation_style": "casual", "new_interests": ["music"], "user_facts": {"name": "Alex"}}'
            }
        },
    )
    with patch.object(ollama._client, "post", new_callable=AsyncMock, return_value=mock_response):
        result = await ollama.analyze_persona(
            messages=[{"role": "user", "content": "I love music"}],
            analysis_prompt="Analyze this.",
        )
        assert result["tone"] == "playful"


@pytest.mark.asyncio
async def test_health_check(ollama):
    mock_response = httpx.Response(200, text="Ollama is running")
    with patch.object(ollama._client, "get", new_callable=AsyncMock, return_value=mock_response):
        assert await ollama.health_check() is True


@pytest.mark.asyncio
async def test_health_check_fails(ollama):
    with patch.object(ollama._client, "get", new_callable=AsyncMock, side_effect=httpx.ConnectError("refused")):
        assert await ollama.health_check() is False
