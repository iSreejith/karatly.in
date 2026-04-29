import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_voice_clone_success(client):
    with patch("app.routers.voice.openvoice_client.clone_voice", new_callable=AsyncMock, return_value=True):
        response = client.post("/api/voice/clone", json={"audio_base64": "wav_data", "session_id": "abc"})
        assert response.status_code == 200
        assert response.json()["success"] is True


def test_voice_clone_failure(client):
    with patch("app.routers.voice.openvoice_client.clone_voice", new_callable=AsyncMock, return_value=False):
        response = client.post("/api/voice/clone", json={"audio_base64": "wav_data", "session_id": "abc"})
        assert response.status_code == 200
        assert response.json()["success"] is False


def test_voice_speak_returns_audio(client):
    fake_audio = b"\x00\x01\x02\x03"
    with patch("app.routers.voice.openvoice_client.speak", new_callable=AsyncMock, return_value=fake_audio):
        response = client.post("/api/voice/speak", json={"text": "Hello", "language": "en", "session_id": "abc"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"


def test_voice_speak_fallback_when_no_audio(client):
    with patch("app.routers.voice.openvoice_client.speak", new_callable=AsyncMock, return_value=None):
        response = client.post("/api/voice/speak", json={"text": "Hello", "language": "en", "session_id": "abc"})
        assert response.status_code == 503
