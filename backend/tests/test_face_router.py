import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_face_analyze_success(client):
    mock_result = {
        "skin_color": "#D2A67D",
        "hair_color": "#3B2417",
        "hair_style": "short_wavy",
        "eye_color": "#5B4C3A",
        "face_shape": "oval",
        "has_glasses": False,
        "has_facial_hair": False,
        "age_range": "25-35",
    }
    with patch("app.routers.face.ollama_client.analyze_face", new_callable=AsyncMock, return_value=mock_result):
        response = client.post("/api/face/analyze", json={"image_base64": "abc123"})
        assert response.status_code == 200
        data = response.json()
        assert data["avatar_config"]["skin_color"] == "#D2A67D"
        assert "raw_description" in data


def test_face_analyze_ollama_fails_gemini_fallback(client):
    mock_result = {
        "skin_color": "#C4956A",
        "hair_color": "#000000",
        "hair_style": "short_straight",
        "eye_color": "#3B2F2F",
        "face_shape": "round",
        "has_glasses": True,
        "has_facial_hair": False,
        "age_range": "30-40",
    }
    with (
        patch("app.routers.face.ollama_client.analyze_face", new_callable=AsyncMock, return_value=None),
        patch("app.routers.face.gemini_client.analyze_face", new_callable=AsyncMock, return_value=mock_result),
    ):
        response = client.post("/api/face/analyze", json={"image_base64": "abc123"})
        assert response.status_code == 200
        data = response.json()
        assert data["avatar_config"]["has_glasses"] is True


def test_face_analyze_both_fail(client):
    with (
        patch("app.routers.face.ollama_client.analyze_face", new_callable=AsyncMock, return_value=None),
        patch("app.routers.face.gemini_client.analyze_face", new_callable=AsyncMock, return_value=None),
    ):
        response = client.post("/api/face/analyze", json={"image_base64": "abc123"})
        assert response.status_code == 500
