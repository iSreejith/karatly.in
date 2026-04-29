import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_chat_new_session(client):
    with patch("app.routers.chat.ollama_client.chat", new_callable=AsyncMock, return_value='Hello there! How are you? {"emotion": "friendly"}'):
        response = client.post("/api/chat", json={"text": "Hi", "language": "en"})
        assert response.status_code == 200
        data = response.json()
        assert "Hello there" in data["text"]
        assert data["emotion"] == "friendly"
        assert "session_id" in data


def test_chat_existing_session(client):
    with patch("app.routers.chat.ollama_client.chat", new_callable=AsyncMock, return_value='Nice to hear that! {"emotion": "amused"}'):
        # First message to create session
        r1 = client.post("/api/chat", json={"text": "Hi", "language": "en"})
        sid = r1.json()["session_id"]

        # Second message with same session
        r2 = client.post("/api/chat", json={"text": "I like music", "language": "en", "session_id": sid})
        assert r2.status_code == 200


def test_chat_start_creates_session_and_greeting(client):
    with patch("app.routers.chat.ollama_client.chat", new_callable=AsyncMock, return_value='Hey! Welcome! {"emotion": "excited"}'):
        response = client.post("/api/chat/start", json={"language": "en"})
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert len(data["text"]) > 0
