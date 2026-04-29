# Karatly.in Digital Twin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that captures the user's face via camera, generates a 3D avatar resembling them, clones their voice, and holds an adaptive spoken conversation — all running locally on Kubernetes.

**Architecture:** Four-pod K8s setup: nginx frontend serving vanilla JS (Three.js + MediaPipe), FastAPI gateway orchestrating requests, Ollama running gemma4 for conversation + vision, and OpenVoice v2 for voice cloning/TTS. STT runs client-side via Web Speech API.

**Tech Stack:** Vanilla JS, Three.js, MediaPipe Face Landmarker, Python FastAPI, Ollama (gemma4), OpenVoice v2, Docker, Kubernetes (Docker Desktop)

---

## File Structure

```
karatly.in/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI entry, CORS, health checks
│   │   ├── config.py               # Environment config
│   │   ├── schemas.py              # All Pydantic models
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── face.py             # POST /api/face/analyze
│   │   │   ├── chat.py             # POST /api/chat
│   │   │   └── voice.py            # POST /api/voice/clone, POST /api/voice/speak
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── ollama_client.py    # Ollama HTTP client
│   │       ├── gemini_client.py    # Gemini API fallback
│   │       ├── openvoice_client.py # OpenVoice HTTP client
│   │       └── persona.py          # Persona state + system prompt builder
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py             # Shared fixtures
│   │   ├── test_schemas.py
│   │   ├── test_persona.py
│   │   ├── test_ollama_client.py
│   │   ├── test_face_router.py
│   │   ├── test_chat_router.py
│   │   └── test_voice_router.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pyproject.toml
├── openvoice-server/
│   ├── server.py                   # FastAPI wrapper around OpenVoice v2
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── index.html                  # Single page, consent + avatar canvas
│   ├── css/
│   │   └── styles.css              # Full-screen dark UI
│   ├── js/
│   │   ├── app.js                  # Main orchestrator
│   │   ├── consent.js              # Consent screen logic
│   │   ├── camera.js               # Camera access + frame capture
│   │   ├── face-mesh.js            # MediaPipe face landmark extraction
│   │   ├── avatar.js               # Three.js scene + avatar mesh generation
│   │   ├── avatar-animation.js     # Idle, lip-sync, expression animations
│   │   ├── speech.js               # Web Speech API STT + audio recording
│   │   ├── audio-player.js         # Play TTS audio + extract viseme timing
│   │   └── api-client.js           # HTTP calls to backend
│   ├── Dockerfile
│   └── nginx.conf
├── k8s/
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── api-gateway/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── ollama/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── init-job.yaml           # Pulls gemma4 model on first run
│   └── openvoice/
│       ├── deployment.yaml
│       └── service.yaml
└── docker-compose.yml
```

---

## Task 1: Project Scaffolding & Backend Config

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create backend pyproject.toml**

```toml
# backend/pyproject.toml
[project]
name = "karatly-backend"
version = "0.1.0"
requires-python = ">=3.12"

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

- [ ] **Step 2: Create requirements.txt**

```txt
# backend/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
httpx==0.27.0
python-multipart==0.0.9
pydantic==2.9.0
google-genai==1.0.0
pytest==8.3.0
pytest-asyncio==0.24.0
pytest-httpx==0.32.0
```

- [ ] **Step 3: Create app/__init__.py and tests/__init__.py**

```python
# backend/app/__init__.py
# (empty)
```

```python
# backend/tests/__init__.py
# (empty)
```

- [ ] **Step 4: Create config.py**

```python
# backend/app/config.py
import os


class Config:
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma4")
    OPENVOICE_BASE_URL: str = os.getenv("OPENVOICE_BASE_URL", "http://localhost:5000")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


config = Config()
```

- [ ] **Step 5: Create conftest.py with shared fixtures**

```python
# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)
```

Note: `app.main` doesn't exist yet — this fixture will work once Task 6 is done. Tests in earlier tasks import it conditionally or test pure functions.

- [ ] **Step 6: Install dependencies and verify**

Run:
```bash
cd backend && pip install -r requirements.txt
```

Expected: all packages install successfully.

- [ ] **Step 7: Commit**

```bash
git init
git add backend/pyproject.toml backend/requirements.txt backend/app/__init__.py backend/app/config.py backend/tests/__init__.py backend/tests/conftest.py
git commit -m "chore: scaffold backend project with config and test setup"
```

---

## Task 2: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas.py`
- Create: `backend/tests/test_schemas.py`

- [ ] **Step 1: Write failing tests for schemas**

```python
# backend/tests/test_schemas.py
from app.schemas import (
    AvatarConfig,
    PersonaState,
    FaceAnalysisRequest,
    FaceAnalysisResponse,
    ChatRequest,
    ChatResponse,
    VoiceCloneRequest,
    VoiceSpeakRequest,
)


def test_avatar_config_defaults():
    config = AvatarConfig(
        skin_color="#D2A67D",
        hair_color="#3B2417",
        hair_style="short_wavy",
        eye_color="#5B4C3A",
    )
    assert config.has_glasses is False
    assert config.has_facial_hair is False


def test_persona_state_defaults():
    state = PersonaState()
    assert state.tone == "friendly"
    assert state.humor_level == 0.5
    assert state.language == "en"
    assert state.interests_discovered == []
    assert state.user_profile == {}
    assert state.conversation_style == "casual"


def test_face_analysis_request():
    req = FaceAnalysisRequest(image_base64="abc123")
    assert req.image_base64 == "abc123"


def test_face_analysis_response():
    resp = FaceAnalysisResponse(
        avatar_config=AvatarConfig(
            skin_color="#D2A67D",
            hair_color="#3B2417",
            hair_style="short_wavy",
            eye_color="#5B4C3A",
        ),
        raw_description="A person with brown hair",
    )
    assert resp.avatar_config.skin_color == "#D2A67D"


def test_chat_request():
    req = ChatRequest(
        text="Hello there",
        language="en",
        session_id="abc",
    )
    assert req.text == "Hello there"


def test_chat_response():
    resp = ChatResponse(text="Hi!", emotion="friendly")
    assert resp.emotion == "friendly"


def test_voice_clone_request():
    req = VoiceCloneRequest(audio_base64="wav_data", session_id="abc")
    assert req.session_id == "abc"


def test_voice_speak_request():
    req = VoiceSpeakRequest(text="Hello", language="en", session_id="abc")
    assert req.text == "Hello"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_schemas.py -v`
Expected: ImportError — schemas module doesn't exist yet.

- [ ] **Step 3: Implement schemas**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_schemas.py -v`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/tests/test_schemas.py
git commit -m "feat: add Pydantic schemas for face, chat, voice, and persona"
```

---

## Task 3: Persona Service

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/persona.py`
- Create: `backend/tests/test_persona.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_persona.py
from app.services.persona import PersonaManager


def test_create_session():
    pm = PersonaManager()
    session_id = pm.create_session("en")
    state = pm.get_state(session_id)
    assert state.language == "en"
    assert state.tone == "friendly"


def test_add_message_and_get_history():
    pm = PersonaManager()
    sid = pm.create_session("en")
    pm.add_message(sid, "user", "I love painting")
    pm.add_message(sid, "assistant", "That's wonderful!")
    history = pm.get_history(sid)
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["content"] == "That's wonderful!"


def test_build_system_prompt():
    pm = PersonaManager()
    sid = pm.create_session("fr")
    prompt = pm.build_system_prompt(sid)
    assert "fr" in prompt
    assert "friendly" in prompt


def test_update_persona_from_analysis():
    pm = PersonaManager()
    sid = pm.create_session("en")
    pm.update_persona(sid, tone="playful", humor_level=0.8)
    state = pm.get_state(sid)
    assert state.tone == "playful"
    assert state.humor_level == 0.8


def test_update_user_profile():
    pm = PersonaManager()
    sid = pm.create_session("en")
    pm.update_user_profile(sid, name="Alex", hobby="painting")
    state = pm.get_state(sid)
    assert state.user_profile["name"] == "Alex"
    assert state.interests_discovered == []


def test_add_interest():
    pm = PersonaManager()
    sid = pm.create_session("en")
    pm.add_interest(sid, "music")
    pm.add_interest(sid, "music")  # duplicate ignored
    state = pm.get_state(sid)
    assert state.interests_discovered == ["music"]


def test_unknown_session_returns_none():
    pm = PersonaManager()
    assert pm.get_state("nonexistent") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_persona.py -v`
Expected: ImportError — persona module doesn't exist.

- [ ] **Step 3: Create services __init__.py**

```python
# backend/app/services/__init__.py
# (empty)
```

- [ ] **Step 4: Implement PersonaManager**

```python
# backend/app/services/persona.py
import uuid
from app.schemas import PersonaState

SYSTEM_PROMPT_TEMPLATE = """You are a digital companion who looks like the user.
Current persona: tone={tone}, humor_level={humor_level}, style={conversation_style}
User profile so far: {user_profile}
Interests discovered: {interests}
Language: {language}

Rules:
- Never ask for typed input — this is voice-only
- Respond naturally in the user's language
- Keep responses concise (2-3 sentences) for natural conversation flow
- Adapt your tone to match the user's energy
- Be entertaining but genuine
- Learn about the user organically — don't interrogate
- Tag your response with an emotion in this JSON format at the end: {{"emotion": "one_word_emotion"}}"""

PERSONA_ANALYSIS_PROMPT = """Based on this conversation so far, analyze the user's personality and update these parameters.
Return ONLY valid JSON with these fields:
- tone: string (friendly/playful/professional/empathetic/curious/witty)
- humor_level: float 0.0-1.0
- conversation_style: string (casual/formal/energetic/calm)
- new_interests: list of strings (topics they seem interested in)
- user_facts: dict of string keys/values (things learned about them, e.g. name, job, hobbies)"""


class PersonaManager:
    def __init__(self):
        self._sessions: dict[str, dict] = {}

    def create_session(self, language: str = "en") -> str:
        session_id = uuid.uuid4().hex[:12]
        self._sessions[session_id] = {
            "state": PersonaState(language=language),
            "history": [],
            "message_count": 0,
        }
        return session_id

    def get_state(self, session_id: str) -> PersonaState | None:
        session = self._sessions.get(session_id)
        if session is None:
            return None
        return session["state"]

    def get_history(self, session_id: str) -> list[dict]:
        session = self._sessions.get(session_id)
        if session is None:
            return []
        return session["history"]

    def add_message(self, session_id: str, role: str, content: str):
        session = self._sessions.get(session_id)
        if session is None:
            return
        session["history"].append({"role": role, "content": content})
        session["message_count"] += 1

    def get_message_count(self, session_id: str) -> int:
        session = self._sessions.get(session_id)
        if session is None:
            return 0
        return session["message_count"]

    def build_system_prompt(self, session_id: str) -> str:
        state = self.get_state(session_id)
        if state is None:
            return ""
        return SYSTEM_PROMPT_TEMPLATE.format(
            tone=state.tone,
            humor_level=state.humor_level,
            conversation_style=state.conversation_style,
            user_profile=state.user_profile or "Nothing yet",
            interests=", ".join(state.interests_discovered) or "None yet",
            language=state.language,
        )

    def update_persona(self, session_id: str, **kwargs):
        session = self._sessions.get(session_id)
        if session is None:
            return
        state = session["state"]
        for key, value in kwargs.items():
            if hasattr(state, key):
                setattr(state, key, value)

    def update_user_profile(self, session_id: str, **kwargs):
        state = self.get_state(session_id)
        if state is None:
            return
        state.user_profile.update(kwargs)

    def add_interest(self, session_id: str, interest: str):
        state = self.get_state(session_id)
        if state is None:
            return
        if interest not in state.interests_discovered:
            state.interests_discovered.append(interest)

    def should_analyze_persona(self, session_id: str) -> bool:
        count = self.get_message_count(session_id)
        return count > 0 and count % 5 == 0

    def get_analysis_prompt(self) -> str:
        return PERSONA_ANALYSIS_PROMPT
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_persona.py -v`
Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/__init__.py backend/app/services/persona.py backend/tests/test_persona.py
git commit -m "feat: add PersonaManager for adaptive conversation personality"
```

---

## Task 4: Ollama Client Service

**Files:**
- Create: `backend/app/services/ollama_client.py`
- Create: `backend/tests/test_ollama_client.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_ollama_client.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_ollama_client.py -v`
Expected: ImportError — ollama_client module doesn't exist.

- [ ] **Step 3: Implement OllamaClient**

```python
# backend/app/services/ollama_client.py
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
        response.raise_for_status()
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
        response.raise_for_status()
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
        response.raise_for_status()
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_ollama_client.py -v`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ollama_client.py backend/tests/test_ollama_client.py
git commit -m "feat: add Ollama client for chat, face analysis, and persona analysis"
```

---

## Task 5: Gemini Fallback Client

**Files:**
- Create: `backend/app/services/gemini_client.py`

- [ ] **Step 1: Implement Gemini fallback client**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/gemini_client.py
git commit -m "feat: add Gemini fallback client for face analysis"
```

---

## Task 6: OpenVoice Client Service

**Files:**
- Create: `backend/app/services/openvoice_client.py`
- Create: `backend/tests/test_voice_router.py` (placeholder — full tests in Task 9)

- [ ] **Step 1: Implement OpenVoice client**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/openvoice_client.py
git commit -m "feat: add OpenVoice HTTP client for voice cloning and TTS"
```

---

## Task 7: Face Analysis Router

**Files:**
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/face.py`
- Create: `backend/tests/test_face_router.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_face_router.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_face_router.py -v`
Expected: ImportError — routers and main don't exist yet.

- [ ] **Step 3: Create routers __init__.py**

```python
# backend/app/routers/__init__.py
# (empty)
```

- [ ] **Step 4: Implement face router**

```python
# backend/app/routers/face.py
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
```

- [ ] **Step 5: Create main.py (minimal, needed for tests)**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import face

app = FastAPI(title="Karatly API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(face.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_face_router.py -v`
Expected: all 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/__init__.py backend/app/routers/face.py backend/app/main.py backend/tests/test_face_router.py
git commit -m "feat: add face analysis router with Ollama + Gemini fallback"
```

---

## Task 8: Chat Router

**Files:**
- Create: `backend/app/routers/chat.py`
- Create: `backend/tests/test_chat_router.py`
- Modify: `backend/app/main.py` (add chat router)

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_chat_router.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_chat_router.py -v`
Expected: FAIL — chat router doesn't exist.

- [ ] **Step 3: Implement chat router**

```python
# backend/app/routers/chat.py
import json
import re
from fastapi import APIRouter
from pydantic import BaseModel
from app.schemas import ChatRequest, ChatResponse
from app.services.ollama_client import OllamaClient
from app.services.persona import PersonaManager
from app.config import config

router = APIRouter(prefix="/api/chat", tags=["chat"])

ollama_client = OllamaClient(base_url=config.OLLAMA_BASE_URL, model=config.OLLAMA_MODEL)
persona_manager = PersonaManager()


class ChatStartRequest(BaseModel):
    language: str = "en"


class ChatStartResponse(BaseModel):
    session_id: str
    text: str
    emotion: str = "friendly"


def parse_emotion(raw_text: str) -> tuple[str, str]:
    """Extract emotion JSON tag from response text. Returns (clean_text, emotion)."""
    match = re.search(r'\{"emotion":\s*"(\w+)"\}', raw_text)
    if match:
        emotion = match.group(1)
        clean_text = raw_text[: match.start()].strip()
        return clean_text, emotion
    return raw_text.strip(), "neutral"


@router.post("/start", response_model=ChatStartResponse)
async def chat_start(request: ChatStartRequest):
    session_id = persona_manager.create_session(request.language)
    system_prompt = persona_manager.build_system_prompt(session_id)

    greeting_prompt = [{"role": "user", "content": f"[System: The user just appeared. Greet them warmly in {request.language}. This is a voice conversation — be brief and natural.]"}]
    raw_response = await ollama_client.chat(system_prompt, greeting_prompt)
    text, emotion = parse_emotion(raw_response)

    persona_manager.add_message(session_id, "assistant", text)

    return ChatStartResponse(session_id=session_id, text=text, emotion=emotion)


@router.post("", response_model=ChatStartResponse)
async def chat(request: ChatRequest):
    session_id = request.session_id

    if not session_id or persona_manager.get_state(session_id) is None:
        session_id = persona_manager.create_session(request.language)

    persona_manager.add_message(session_id, "user", request.text)

    # Check if we should analyze persona (every 5 messages)
    if persona_manager.should_analyze_persona(session_id):
        try:
            analysis = await ollama_client.analyze_persona(
                messages=persona_manager.get_history(session_id),
                analysis_prompt=persona_manager.get_analysis_prompt(),
            )
            if analysis:
                persona_manager.update_persona(
                    session_id,
                    tone=analysis.get("tone", "friendly"),
                    humor_level=analysis.get("humor_level", 0.5),
                    conversation_style=analysis.get("conversation_style", "casual"),
                )
                for interest in analysis.get("new_interests", []):
                    persona_manager.add_interest(session_id, interest)
                for key, value in analysis.get("user_facts", {}).items():
                    persona_manager.update_user_profile(session_id, **{key: value})
        except Exception:
            pass  # Non-critical — continue with current persona

    system_prompt = persona_manager.build_system_prompt(session_id)
    history = persona_manager.get_history(session_id)
    raw_response = await ollama_client.chat(system_prompt, history)
    text, emotion = parse_emotion(raw_response)

    persona_manager.add_message(session_id, "assistant", text)

    return ChatStartResponse(session_id=session_id, text=text, emotion=emotion)
```

- [ ] **Step 4: Register chat router in main.py**

Add to `backend/app/main.py`:

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import face, chat

app = FastAPI(title="Karatly API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(face.router)
app.include_router(chat.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_chat_router.py -v`
Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/chat.py backend/app/main.py backend/tests/test_chat_router.py
git commit -m "feat: add chat router with adaptive persona and emotion tagging"
```

---

## Task 9: Voice Router

**Files:**
- Create: `backend/app/routers/voice.py`
- Create: `backend/tests/test_voice_router.py`
- Modify: `backend/app/main.py` (add voice router)

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_voice_router.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_voice_router.py -v`
Expected: ImportError — voice router doesn't exist.

- [ ] **Step 3: Implement voice router**

```python
# backend/app/routers/voice.py
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
```

- [ ] **Step 4: Register voice router in main.py**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import face, chat, voice

app = FastAPI(title="Karatly API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(face.router)
app.include_router(chat.router)
app.include_router(voice.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_voice_router.py -v`
Expected: all 4 tests PASS.

- [ ] **Step 6: Run full backend test suite**

Run: `cd backend && python -m pytest -v`
Expected: all tests PASS (schemas + persona + ollama + face + chat + voice).

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/voice.py backend/app/main.py backend/tests/test_voice_router.py
git commit -m "feat: add voice router for cloning and TTS"
```

---

## Task 10: OpenVoice Server Wrapper

**Files:**
- Create: `openvoice-server/server.py`
- Create: `openvoice-server/requirements.txt`
- Create: `openvoice-server/Dockerfile`

- [ ] **Step 1: Create requirements.txt**

```txt
# openvoice-server/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
openvoice==2.0.0
torch>=2.0.0
numpy
soundfile
python-multipart
```

- [ ] **Step 2: Implement OpenVoice server**

```python
# openvoice-server/server.py
import os
import io
import base64
import uuid
import logging
import soundfile as sf
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="OpenVoice TTS Server")
logger = logging.getLogger("openvoice-server")

# Global state for voice embeddings per session
voice_embeddings: dict[str, object] = {}
default_speaker_embedding = None
tts_model = None
tone_converter = None


class CloneRequest(BaseModel):
    audio_base64: str
    session_id: str


class SpeakRequest(BaseModel):
    text: str
    language: str = "en"
    session_id: str = ""


def load_models():
    global tts_model, tone_converter, default_speaker_embedding
    try:
        from openvoice.api import ToneColorConverter, BaseSpeakerTTS

        ckpt_converter = os.getenv("CONVERTER_CKPT", "checkpoints_v2/converter")
        ckpt_base = os.getenv("BASE_CKPT", "checkpoints_v2/base_speakers/ses")

        tone_converter = ToneColorConverter(f"{ckpt_converter}/config.json")
        tone_converter.load_ckpt(f"{ckpt_converter}/checkpoint.pth")

        tts_model = BaseSpeakerTTS(f"{ckpt_base}/config.json")
        tts_model.load_ckpt(f"{ckpt_base}/checkpoint.pth")

        logger.info("OpenVoice models loaded successfully")
    except Exception as e:
        logger.warning(f"Could not load OpenVoice models: {e}. Running in stub mode.")


@app.on_event("startup")
async def startup():
    load_models()


@app.get("/health")
async def health():
    return {"status": "ok", "models_loaded": tts_model is not None}


@app.post("/clone")
async def clone_voice(request: CloneRequest):
    if tone_converter is None:
        return {"success": False, "error": "Models not loaded"}

    try:
        audio_bytes = base64.b64decode(request.audio_base64)
        tmp_path = f"/tmp/{request.session_id}_ref.wav"
        with open(tmp_path, "wb") as f:
            f.write(audio_bytes)

        from openvoice import se_extractor

        embedding = se_extractor.get_se(tmp_path, tone_converter, vad=True)
        voice_embeddings[request.session_id] = embedding
        return {"success": True}
    except Exception as e:
        logger.error(f"Voice cloning failed: {e}")
        return {"success": False, "error": str(e)}


@app.post("/speak")
async def speak(request: SpeakRequest):
    if tts_model is None:
        return {"detail": "Models not loaded"}, 503

    try:
        tmp_base = f"/tmp/{uuid.uuid4().hex}"
        base_path = f"{tmp_base}_base.wav"

        # Generate base TTS audio
        lang_map = {
            "en": "EN", "es": "ES", "fr": "FR", "de": "DE",
            "it": "IT", "pt": "PT", "pl": "PL", "tr": "TR",
            "ru": "RU", "nl": "NL", "cs": "CS", "ar": "AR",
            "zh": "ZH", "ja": "JP", "ko": "KR", "hi": "HI",
        }
        ov_lang = lang_map.get(request.language[:2].lower(), "EN")
        tts_model.tts(request.text, base_path, speaker="default", language=ov_lang)

        # Apply voice cloning if embedding exists
        output_path = base_path
        embedding = voice_embeddings.get(request.session_id)
        if embedding is not None:
            output_path = f"{tmp_base}_converted.wav"
            tone_converter.convert(
                audio_src_path=base_path,
                src_se=tts_model.default_se,
                tgt_se=embedding,
                output_path=output_path,
            )

        with open(output_path, "rb") as f:
            audio_data = f.read()

        from fastapi.responses import Response
        return Response(content=audio_data, media_type="audio/wav")

    except Exception as e:
        logger.error(f"TTS failed: {e}")
        return {"detail": str(e)}, 500
```

- [ ] **Step 3: Create Dockerfile**

```dockerfile
# openvoice-server/Dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 ffmpeg git && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Clone OpenVoice and download checkpoints
RUN pip install --no-cache-dir git+https://github.com/myshell-ai/OpenVoice.git && \
    python -c "from openvoice.api import ToneColorConverter; print('OpenVoice installed')" || true

COPY server.py .

EXPOSE 5000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5000"]
```

- [ ] **Step 4: Commit**

```bash
git add openvoice-server/
git commit -m "feat: add OpenVoice v2 TTS server with voice cloning"
```

---

## Task 11: Frontend — HTML & Consent Screen

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/css/styles.css`
- Create: `frontend/js/consent.js`

- [ ] **Step 1: Create index.html**

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Karatly</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <!-- Consent Screen -->
    <div id="consent-screen" class="screen active">
        <div class="consent-container">
            <h1>Karatly</h1>
            <p>This experience uses your camera and microphone to create a digital companion that looks and sounds like you.</p>
            <p class="consent-note">Your data stays on this device. Nothing is uploaded to the cloud.</p>
            <button id="consent-btn" class="primary-btn">Allow Camera & Microphone</button>
        </div>
    </div>

    <!-- Loading Screen -->
    <div id="loading-screen" class="screen">
        <div class="loading-container">
            <div class="spinner"></div>
            <p id="loading-status">Initializing camera...</p>
        </div>
    </div>

    <!-- Avatar Screen -->
    <div id="avatar-screen" class="screen">
        <canvas id="avatar-canvas"></canvas>
        <video id="camera-feed" autoplay playsinline style="display:none;"></video>
        <div id="status-bar">
            <span id="language-indicator"></span>
            <span id="listening-indicator">Listening...</span>
        </div>
    </div>

    <!-- Scripts -->
    <script type="importmap">
    {
        "imports": {
            "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
            "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
        }
    }
    </script>
    <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create styles.css**

```css
/* frontend/css/styles.css */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    background: #0a0a0f;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
    height: 100vh;
    width: 100vw;
}

.screen {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: none;
    justify-content: center;
    align-items: center;
}

.screen.active {
    display: flex;
}

/* Consent Screen */
.consent-container {
    text-align: center;
    max-width: 480px;
    padding: 2rem;
}

.consent-container h1 {
    font-size: 3rem;
    font-weight: 300;
    margin-bottom: 1.5rem;
    background: linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.consent-container p {
    font-size: 1.1rem;
    line-height: 1.6;
    margin-bottom: 1rem;
    color: #a0a0b0;
}

.consent-note {
    font-size: 0.9rem !important;
    color: #707080 !important;
}

.primary-btn {
    margin-top: 1.5rem;
    padding: 1rem 2.5rem;
    font-size: 1.1rem;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.primary-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.3);
}

/* Loading Screen */
.loading-container {
    text-align: center;
}

.spinner {
    width: 48px;
    height: 48px;
    border: 3px solid #2a2a3a;
    border-top-color: #8b5cf6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1.5rem;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

#loading-status {
    color: #a0a0b0;
    font-size: 1rem;
}

/* Avatar Screen */
#avatar-canvas {
    width: 100%;
    height: 100%;
    display: block;
}

#status-bar {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 1.5rem;
    padding: 0.75rem 1.5rem;
    background: rgba(15, 15, 25, 0.8);
    border-radius: 999px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(99, 102, 241, 0.2);
}

#status-bar span {
    font-size: 0.85rem;
    color: #8b5cf6;
}

#listening-indicator::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    margin-right: 6px;
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}
```

- [ ] **Step 3: Create consent.js**

```javascript
// frontend/js/consent.js

export function initConsent() {
    return new Promise((resolve) => {
        const btn = document.getElementById('consent-btn');
        btn.addEventListener('click', () => {
            resolve();
        }, { once: true });
    });
}

export function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

export function setLoadingStatus(message) {
    document.getElementById('loading-status').textContent = message;
}
```

- [ ] **Step 4: Verify in browser manually**

Open `frontend/index.html` in a browser. You should see the consent screen with a purple gradient title and a button.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/css/styles.css frontend/js/consent.js
git commit -m "feat: add frontend HTML, CSS, and consent screen"
```

---

## Task 12: Frontend — Camera & MediaPipe Face Mesh

**Files:**
- Create: `frontend/js/camera.js`
- Create: `frontend/js/face-mesh.js`

- [ ] **Step 1: Create camera.js**

```javascript
// frontend/js/camera.js

let videoElement = null;
let stream = null;

export async function initCamera() {
    videoElement = document.getElementById('camera-feed');
    stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true,
    });
    videoElement.srcObject = stream;
    await new Promise((resolve) => {
        videoElement.onloadedmetadata = resolve;
    });
    return videoElement;
}

export function captureFrame() {
    if (!videoElement) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);
    // Return base64 without the data:image/... prefix
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

export function getAudioStream() {
    if (!stream) return null;
    return new MediaStream(stream.getAudioTracks());
}

export function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}
```

- [ ] **Step 2: Create face-mesh.js**

```javascript
// frontend/js/face-mesh.js

let faceLandmarker = null;

export async function initFaceMesh() {
    const { FaceLandmarker, FilesetResolver } = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs'
    );

    const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
    });
}

export function detectFace(videoElement, timestampMs) {
    if (!faceLandmarker) return null;
    const results = faceLandmarker.detectForVideo(videoElement, timestampMs);
    if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
        return null;
    }
    return {
        landmarks: results.faceLandmarks[0],          // 468 points [{x, y, z}, ...]
        blendshapes: results.faceBlendshapes?.[0]?.categories || [],
        transformMatrix: results.facialTransformationMatrixes?.[0] || null,
    };
}

export function getLandmarkPositions(landmarks) {
    // Convert normalized landmarks to Float32Array for Three.js
    const positions = new Float32Array(landmarks.length * 3);
    for (let i = 0; i < landmarks.length; i++) {
        positions[i * 3] = landmarks[i].x;
        positions[i * 3 + 1] = landmarks[i].y;
        positions[i * 3 + 2] = landmarks[i].z;
    }
    return positions;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/camera.js frontend/js/face-mesh.js
git commit -m "feat: add camera access and MediaPipe face mesh extraction"
```

---

## Task 13: Frontend — API Client

**Files:**
- Create: `frontend/js/api-client.js`

- [ ] **Step 1: Create api-client.js**

```javascript
// frontend/js/api-client.js

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : '/api';

export async function analyzeFace(imageBase64) {
    const response = await fetch(`${API_BASE}/api/face/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64 }),
    });
    if (!response.ok) throw new Error(`Face analysis failed: ${response.status}`);
    return response.json();
}

export async function startChat(language) {
    const response = await fetch(`${API_BASE}/api/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
    });
    if (!response.ok) throw new Error(`Chat start failed: ${response.status}`);
    return response.json();
}

export async function sendChat(text, language, sessionId) {
    const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, session_id: sessionId }),
    });
    if (!response.ok) throw new Error(`Chat failed: ${response.status}`);
    return response.json();
}

export async function cloneVoice(audioBase64, sessionId) {
    const response = await fetch(`${API_BASE}/api/voice/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_base64: audioBase64, session_id: sessionId }),
    });
    if (!response.ok) return { success: false };
    return response.json();
}

export async function speak(text, language, sessionId) {
    const response = await fetch(`${API_BASE}/api/voice/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, session_id: sessionId }),
    });
    if (!response.ok) return null;
    return response.arrayBuffer();
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/api-client.js
git commit -m "feat: add frontend API client for face, chat, and voice endpoints"
```

---

## Task 14: Frontend — Three.js Avatar

**Files:**
- Create: `frontend/js/avatar.js`

- [ ] **Step 1: Create avatar.js**

This is the core 3D rendering module. It creates a stylized head from MediaPipe landmarks and colors it based on the AI's face analysis.

```javascript
// frontend/js/avatar.js
import * as THREE from 'three';

let scene, camera, renderer, headMesh, leftEyeMesh, rightEyeMesh;
let hairMesh, glassesMesh;

// Blend shape morph targets for expressions
const EXPRESSION_MORPHS = {
    smile: { mouthSmile: 1.0, eyeSquint: 0.3 },
    surprised: { mouthOpen: 0.8, eyeWide: 0.7 },
    thinking: { browDown: 0.5, mouthPurse: 0.3 },
    amused: { mouthSmile: 0.7, eyeSquint: 0.2 },
    friendly: { mouthSmile: 0.4 },
    neutral: {},
    excited: { mouthSmile: 0.9, eyeWide: 0.4 },
    empathetic: { browUp: 0.3, mouthSmile: 0.2 },
};

// Viseme shapes for lip sync (maps phoneme categories to mouth morph weights)
const VISEME_MAP = {
    silent: { jawOpen: 0, mouthSmile: 0 },
    pp: { jawOpen: 0.05, lipPress: 0.8 },
    ff: { jawOpen: 0.1, lipBite: 0.6 },
    th: { jawOpen: 0.15, tongueOut: 0.4 },
    dd: { jawOpen: 0.2, tongueUp: 0.5 },
    kk: { jawOpen: 0.25, tongueBack: 0.5 },
    ch: { jawOpen: 0.2, lipPucker: 0.4 },
    ss: { jawOpen: 0.1, lipStretch: 0.5 },
    nn: { jawOpen: 0.15, tongueUp: 0.3 },
    rr: { jawOpen: 0.2, lipPucker: 0.3 },
    aa: { jawOpen: 0.6, mouthStretch: 0.3 },
    ee: { jawOpen: 0.3, lipStretch: 0.6 },
    ih: { jawOpen: 0.35, lipStretch: 0.3 },
    oh: { jawOpen: 0.5, lipPucker: 0.5 },
    oo: { jawOpen: 0.3, lipPucker: 0.8 },
};

export function initAvatar(canvas) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    camera = new THREE.PerspectiveCamera(35, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 2.5);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Soft lighting setup
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
    fillLight.position.set(-2, 1, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);

    window.addEventListener('resize', () => {
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    });

    return { scene, camera, renderer };
}

export function buildAvatar(avatarConfig, landmarks) {
    // Clear previous avatar
    if (headMesh) scene.remove(headMesh);
    if (hairMesh) scene.remove(hairMesh);
    if (leftEyeMesh) scene.remove(leftEyeMesh);
    if (rightEyeMesh) scene.remove(rightEyeMesh);
    if (glassesMesh) scene.remove(glassesMesh);

    // --- Head ---
    const headGeometry = new THREE.SphereGeometry(0.55, 64, 48);

    // Deform sphere to match face shape
    if (avatarConfig.face_shape === 'round') {
        headGeometry.scale(1.0, 0.95, 0.95);
    } else if (avatarConfig.face_shape === 'square') {
        headGeometry.scale(1.0, 1.0, 0.9);
    } else if (avatarConfig.face_shape === 'heart') {
        headGeometry.scale(0.95, 1.05, 0.9);
    } else if (avatarConfig.face_shape === 'oblong') {
        headGeometry.scale(0.9, 1.1, 0.9);
    }

    // Setup morph targets for expressions
    setupMorphTargets(headGeometry);

    const skinMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(avatarConfig.skin_color),
        roughness: 0.7,
        metalness: 0.05,
    });

    headMesh = new THREE.Mesh(headGeometry, skinMaterial);
    headMesh.morphTargetInfluences = new Array(headGeometry.morphAttributes.position?.length || 8).fill(0);
    scene.add(headMesh);

    // --- Eyes ---
    const eyeGeometry = new THREE.SphereGeometry(0.06, 32, 32);
    const eyeMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(avatarConfig.eye_color),
        roughness: 0.3,
        metalness: 0.1,
    });

    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5f5f5,
        roughness: 0.3,
    });

    // Eye whites
    const leftEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 32), eyeWhiteMaterial);
    leftEyeWhite.position.set(-0.17, 0.08, 0.42);
    headMesh.add(leftEyeWhite);

    const rightEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 32), eyeWhiteMaterial);
    rightEyeWhite.position.set(0.17, 0.08, 0.42);
    headMesh.add(rightEyeWhite);

    // Irises
    leftEyeMesh = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEyeMesh.position.set(-0.17, 0.08, 0.48);
    headMesh.add(leftEyeMesh);

    rightEyeMesh = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEyeMesh.position.set(0.17, 0.08, 0.48);
    headMesh.add(rightEyeMesh);

    // Pupils
    const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const pupilGeometry = new THREE.SphereGeometry(0.03, 16, 16);

    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(0, 0, 0.04);
    leftEyeMesh.add(leftPupil);

    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0, 0, 0.04);
    rightEyeMesh.add(rightPupil);

    // --- Nose (subtle bump) ---
    const noseGeometry = new THREE.SphereGeometry(0.06, 16, 16);
    noseGeometry.scale(0.8, 0.6, 1.0);
    const noseMesh = new THREE.Mesh(noseGeometry, skinMaterial);
    noseMesh.position.set(0, -0.05, 0.52);
    headMesh.add(noseMesh);

    // --- Mouth (torus for lips) ---
    const mouthGeometry = new THREE.TorusGeometry(0.08, 0.02, 8, 16, Math.PI);
    const mouthMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(avatarConfig.skin_color).offsetHSL(0, 0.1, -0.1),
        roughness: 0.5,
    });
    const mouthMesh = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouthMesh.position.set(0, -0.18, 0.46);
    mouthMesh.rotation.x = Math.PI;
    headMesh.add(mouthMesh);

    // --- Hair ---
    buildHair(avatarConfig);

    // --- Glasses (optional) ---
    if (avatarConfig.has_glasses) {
        buildGlasses();
    }

    return headMesh;
}

function setupMorphTargets(geometry) {
    // Create morph target positions for facial expressions
    const positionAttribute = geometry.attributes.position;
    const count = positionAttribute.count;

    // jawOpen — lower vertices move down
    const jawOpen = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const y = positionAttribute.getY(i);
        if (y < -0.1) {
            jawOpen[i * 3 + 1] = -0.08;
        }
    }

    // mouthSmile — side vertices move up and outward
    const mouthSmile = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        const z = positionAttribute.getZ(i);
        if (y < 0 && y > -0.3 && z > 0.3) {
            mouthSmile[i * 3] = Math.sign(x) * 0.02;
            mouthSmile[i * 3 + 1] = 0.03;
        }
    }

    geometry.morphAttributes.position = [
        new THREE.Float32BufferAttribute(jawOpen, 3),       // 0: jawOpen
        new THREE.Float32BufferAttribute(mouthSmile, 3),    // 1: mouthSmile
    ];
}

function buildHair(config) {
    const hairColor = new THREE.Color(config.hair_color);
    const hairMaterial = new THREE.MeshStandardMaterial({
        color: hairColor,
        roughness: 0.8,
        metalness: 0.05,
    });

    const style = config.hair_style || 'short_straight';

    if (style === 'bald') return;

    // Base hair cap
    const capGeometry = new THREE.SphereGeometry(0.57, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
    hairMesh = new THREE.Mesh(capGeometry, hairMaterial);
    hairMesh.position.set(0, 0.05, 0);

    // Extend hair based on length
    if (style.startsWith('long_')) {
        const backGeometry = new THREE.CylinderGeometry(0.35, 0.25, 0.6, 16, 1, true);
        const backHair = new THREE.Mesh(backGeometry, hairMaterial);
        backHair.position.set(0, -0.35, -0.15);
        hairMesh.add(backHair);
    } else if (style.startsWith('medium_')) {
        const backGeometry = new THREE.CylinderGeometry(0.4, 0.3, 0.3, 16, 1, true);
        const backHair = new THREE.Mesh(backGeometry, hairMaterial);
        backHair.position.set(0, -0.2, -0.1);
        hairMesh.add(backHair);
    }

    headMesh.add(hairMesh);
}

function buildGlasses() {
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.3,
        metalness: 0.7,
    });

    const lensMaterial = new THREE.MeshStandardMaterial({
        color: 0x88bbff,
        transparent: true,
        opacity: 0.15,
        roughness: 0.1,
    });

    // Left lens
    const lensGeometry = new THREE.RingGeometry(0.07, 0.09, 32);
    const leftFrame = new THREE.Mesh(lensGeometry, frameMaterial);
    leftFrame.position.set(-0.17, 0.08, 0.5);
    headMesh.add(leftFrame);

    const leftLens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), lensMaterial);
    leftLens.position.set(-0.17, 0.08, 0.5);
    headMesh.add(leftLens);

    // Right lens
    const rightFrame = new THREE.Mesh(lensGeometry, frameMaterial);
    rightFrame.position.set(0.17, 0.08, 0.5);
    headMesh.add(rightFrame);

    const rightLens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), lensMaterial);
    rightLens.position.set(0.17, 0.08, 0.5);
    headMesh.add(rightLens);

    // Bridge
    const bridgeGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8);
    const bridge = new THREE.Mesh(bridgeGeometry, frameMaterial);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.08, 0.5);
    headMesh.add(bridge);

    glassesMesh = leftFrame;
}

export function setExpression(emotionName) {
    if (!headMesh || !headMesh.morphTargetInfluences) return;
    // Reset all morph targets
    for (let i = 0; i < headMesh.morphTargetInfluences.length; i++) {
        headMesh.morphTargetInfluences[i] = 0;
    }
    // Apply emotion morphs (simplified — maps to jawOpen and mouthSmile)
    const morphs = EXPRESSION_MORPHS[emotionName] || EXPRESSION_MORPHS.neutral;
    if (morphs.mouthSmile) headMesh.morphTargetInfluences[1] = morphs.mouthSmile;
    if (morphs.mouthOpen || morphs.jawOpen) headMesh.morphTargetInfluences[0] = morphs.mouthOpen || morphs.jawOpen || 0;
}

export function setViseme(visemeName) {
    if (!headMesh || !headMesh.morphTargetInfluences) return;
    const viseme = VISEME_MAP[visemeName] || VISEME_MAP.silent;
    headMesh.morphTargetInfluences[0] = viseme.jawOpen || 0;
}

export function getHeadMesh() {
    return headMesh;
}

export function renderFrame() {
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/avatar.js
git commit -m "feat: add Three.js avatar with face geometry, expressions, and visemes"
```

---

## Task 15: Frontend — Avatar Animation

**Files:**
- Create: `frontend/js/avatar-animation.js`

- [ ] **Step 1: Create avatar-animation.js**

```javascript
// frontend/js/avatar-animation.js
import { getHeadMesh, setExpression, setViseme, renderFrame } from './avatar.js';

let animationId = null;
let blinkTimer = 0;
let nextBlinkTime = 2000 + Math.random() * 4000;
let breathPhase = 0;
let headSwayPhase = 0;
let isSpeaking = false;
let currentVisemeIndex = 0;
let visemeSequence = [];
let visemeStartTime = 0;
let currentEmotion = 'friendly';

// Simple viseme sequence generator from text
// In production this would come from TTS phoneme data
const CHAR_TO_VISEME = {
    'a': 'aa', 'e': 'ee', 'i': 'ih', 'o': 'oh', 'u': 'oo',
    'b': 'pp', 'p': 'pp', 'm': 'pp',
    'f': 'ff', 'v': 'ff',
    't': 'dd', 'd': 'dd', 'l': 'dd', 'n': 'nn',
    'k': 'kk', 'g': 'kk',
    's': 'ss', 'z': 'ss',
    'r': 'rr',
    'ch': 'ch', 'sh': 'ch', 'j': 'ch',
    'th': 'th',
};

export function startAnimationLoop() {
    let lastTime = 0;

    function animate(time) {
        const delta = time - lastTime;
        lastTime = time;

        updateIdle(time, delta);

        if (isSpeaking) {
            updateLipSync(time);
        }

        renderFrame();
        animationId = requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);
}

export function stopAnimationLoop() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

function updateIdle(time, delta) {
    const head = getHeadMesh();
    if (!head) return;

    // Breathing — subtle Y scale oscillation
    breathPhase += delta * 0.002;
    const breathAmount = Math.sin(breathPhase) * 0.005;
    head.position.y = breathAmount;

    // Head sway — very subtle X rotation
    headSwayPhase += delta * 0.0005;
    head.rotation.y = Math.sin(headSwayPhase) * 0.03;
    head.rotation.x = Math.sin(headSwayPhase * 0.7) * 0.01;

    // Blinking
    blinkTimer += delta;
    if (blinkTimer >= nextBlinkTime) {
        blink(head);
        blinkTimer = 0;
        nextBlinkTime = 2000 + Math.random() * 4000;
    }
}

function blink(head) {
    // Quick scale Y on eye meshes
    const eyes = head.children.filter(c => c.geometry?.parameters?.radius === 0.09);
    eyes.forEach(eye => {
        eye.scale.y = 0.1;
        setTimeout(() => { eye.scale.y = 1; }, 150);
    });
}

function updateLipSync(time) {
    if (visemeSequence.length === 0) return;

    const elapsed = time - visemeStartTime;
    const visemeDuration = 80; // ms per viseme
    const index = Math.floor(elapsed / visemeDuration);

    if (index >= visemeSequence.length) {
        isSpeaking = false;
        setViseme('silent');
        setExpression(currentEmotion);
        return;
    }

    if (index !== currentVisemeIndex) {
        currentVisemeIndex = index;
        setViseme(visemeSequence[index]);
    }
}

export function speakText(text, emotion) {
    currentEmotion = emotion || 'neutral';
    setExpression(emotion);

    // Generate a rough viseme sequence from text
    visemeSequence = textToVisemes(text);
    currentVisemeIndex = -1;
    visemeStartTime = performance.now();
    isSpeaking = true;
}

export function setAvatarEmotion(emotion) {
    currentEmotion = emotion;
    if (!isSpeaking) {
        setExpression(emotion);
    }
}

function textToVisemes(text) {
    const visemes = [];
    const lower = text.toLowerCase().replace(/[^a-z ]/g, '');

    for (let i = 0; i < lower.length; i++) {
        const char = lower[i];
        if (char === ' ') {
            visemes.push('silent');
        } else {
            // Check digraphs
            const digraph = lower.substring(i, i + 2);
            if (CHAR_TO_VISEME[digraph]) {
                visemes.push(CHAR_TO_VISEME[digraph]);
                i++;
            } else if (CHAR_TO_VISEME[char]) {
                visemes.push(CHAR_TO_VISEME[char]);
            } else {
                visemes.push('dd'); // fallback
            }
        }
    }

    return visemes;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/avatar-animation.js
git commit -m "feat: add avatar animation with idle, blink, lip-sync, and expressions"
```

---

## Task 16: Frontend — Speech & Audio

**Files:**
- Create: `frontend/js/speech.js`
- Create: `frontend/js/audio-player.js`

- [ ] **Step 1: Create speech.js**

```javascript
// frontend/js/speech.js

let recognition = null;
let mediaRecorder = null;
let audioChunks = [];
let isListening = false;
let detectedLanguage = 'en';

export function getDetectedLanguage() {
    return detectedLanguage;
}

export function initSpeechRecognition(onResult, onError) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error('Web Speech API not supported');
        onError?.('Speech recognition not supported in this browser');
        return false;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;

    // Auto-detect language from browser
    const browserLang = navigator.language || 'en-US';
    recognition.lang = browserLang;
    detectedLanguage = browserLang.split('-')[0];

    recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        if (last.isFinal) {
            const text = last[0].transcript.trim();
            if (text) {
                onResult(text, detectedLanguage);
            }
        }
    };

    recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
            onError?.(event.error);
        }
    };

    recognition.onend = () => {
        if (isListening) {
            recognition.start();
        }
    };

    return true;
}

export function startListening() {
    if (!recognition) return;
    isListening = true;
    recognition.start();
    updateListeningIndicator(true);
}

export function stopListening() {
    isListening = false;
    if (recognition) {
        recognition.stop();
    }
    updateListeningIndicator(false);
}

export function pauseListening() {
    if (recognition && isListening) {
        recognition.stop();
    }
}

export function resumeListening() {
    if (recognition && isListening) {
        recognition.start();
    }
}

function updateListeningIndicator(active) {
    const indicator = document.getElementById('listening-indicator');
    if (indicator) {
        indicator.textContent = active ? 'Listening...' : 'Processing...';
    }
}

// Audio recording for voice cloning
export function startAudioRecording(audioStream) {
    return new Promise((resolve) => {
        audioChunks = [];
        mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            const buffer = await blob.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            resolve(base64);
        };

        mediaRecorder.start();

        // Record for 8 seconds then stop
        setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        }, 8000);
    });
}
```

- [ ] **Step 2: Create audio-player.js**

```javascript
// frontend/js/audio-player.js

let audioContext = null;

export function initAudioPlayer() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

export async function playAudio(audioArrayBuffer) {
    if (!audioContext) initAudioPlayer();

    try {
        const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);

        return new Promise((resolve) => {
            source.onended = resolve;
        });
    } catch (err) {
        console.error('Audio playback failed:', err);
        // Fallback: use Audio element
        const blob = new Blob([audioArrayBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        return new Promise((resolve) => {
            audio.onended = () => {
                URL.revokeObjectURL(url);
                resolve();
            };
            audio.play().catch(resolve);
        });
    }
}

export function getAudioDuration(audioArrayBuffer) {
    if (!audioContext) initAudioPlayer();
    return audioContext.decodeAudioData(audioArrayBuffer.slice(0))
        .then(buffer => buffer.duration)
        .catch(() => 2.0);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/speech.js frontend/js/audio-player.js
git commit -m "feat: add speech recognition and audio playback modules"
```

---

## Task 17: Frontend — Main App Orchestrator

**Files:**
- Create: `frontend/js/app.js`

- [ ] **Step 1: Create app.js — the main orchestration flow**

```javascript
// frontend/js/app.js
import { initConsent, showScreen, setLoadingStatus } from './consent.js';
import { initCamera, captureFrame, getAudioStream, stopCamera } from './camera.js';
import { initFaceMesh, detectFace } from './face-mesh.js';
import { initAvatar, buildAvatar } from './avatar.js';
import { startAnimationLoop, speakText, setAvatarEmotion } from './avatar-animation.js';
import {
    initSpeechRecognition,
    startListening,
    pauseListening,
    resumeListening,
    startAudioRecording,
    getDetectedLanguage,
} from './speech.js';
import { initAudioPlayer, playAudio } from './audio-player.js';
import { analyzeFace, startChat, sendChat, cloneVoice, speak } from './api-client.js';

let sessionId = null;
let isProcessing = false;

async function main() {
    // Step 1: Wait for consent
    await initConsent();

    // Step 2: Show loading, initialize everything
    showScreen('loading-screen');

    setLoadingStatus('Starting camera...');
    const videoElement = await initCamera();

    setLoadingStatus('Loading face detection...');
    await initFaceMesh();

    // Step 3: Detect face from camera
    setLoadingStatus('Looking for your face...');
    let faceData = null;
    for (let attempt = 0; attempt < 30; attempt++) {
        faceData = detectFace(videoElement, performance.now());
        if (faceData) break;
        await sleep(200);
    }

    // Step 4: Capture frame and analyze face
    setLoadingStatus('Analyzing your face...');
    const frameBase64 = captureFrame();
    let avatarConfig;
    try {
        const analysis = await analyzeFace(frameBase64);
        avatarConfig = analysis.avatar_config;
    } catch (err) {
        console.error('Face analysis failed, using defaults:', err);
        avatarConfig = {
            skin_color: '#D2A67D',
            hair_color: '#3B2417',
            hair_style: 'short_wavy',
            eye_color: '#5B4C3A',
            face_shape: 'oval',
            has_glasses: false,
            has_facial_hair: false,
        };
    }

    // Step 5: Build 3D avatar
    setLoadingStatus('Creating your avatar...');
    const canvas = document.getElementById('avatar-canvas');
    initAvatar(canvas);
    buildAvatar(avatarConfig, faceData?.landmarks);
    startAnimationLoop();

    // Step 6: Initialize audio
    initAudioPlayer();

    // Step 7: Start voice cloning in background
    setLoadingStatus('Preparing voice...');
    const audioStream = getAudioStream();
    let voiceClonePromise = null;

    // Step 8: Start conversation
    const language = getDetectedLanguage() || navigator.language?.split('-')[0] || 'en';
    document.getElementById('language-indicator').textContent = language.toUpperCase();

    showScreen('avatar-screen');

    // Start chat — get initial greeting
    try {
        const greeting = await startChat(language);
        sessionId = greeting.session_id;
        setAvatarEmotion(greeting.emotion);

        // Speak the greeting
        await sayText(greeting.text, greeting.emotion);
    } catch (err) {
        console.error('Chat start failed:', err);
    }

    // Step 9: Start voice cloning from user's first words
    if (audioStream) {
        voiceClonePromise = startAudioRecording(audioStream).then(async (audioBase64) => {
            if (sessionId) {
                try {
                    await cloneVoice(audioBase64, sessionId);
                    console.log('Voice cloned successfully');
                } catch (err) {
                    console.warn('Voice cloning failed, using default voice:', err);
                }
            }
        });
    }

    // Step 10: Start listening for user speech
    initSpeechRecognition(onUserSpeech, (err) => {
        console.warn('Speech recognition error:', err);
    });
    startListening();
}

async function onUserSpeech(text, language) {
    if (isProcessing || !sessionId) return;
    isProcessing = true;
    pauseListening();

    try {
        // Send to chat API
        const response = await sendChat(text, language, sessionId);
        setAvatarEmotion(response.emotion);

        // Speak the response
        await sayText(response.text, response.emotion);
    } catch (err) {
        console.error('Chat error:', err);
    }

    isProcessing = false;
    resumeListening();
}

async function sayText(text, emotion) {
    // Start lip sync animation
    speakText(text, emotion);

    // Try to get TTS audio
    try {
        const audioData = await speak(text, getDetectedLanguage(), sessionId);
        if (audioData) {
            await playAudio(audioData);
            return;
        }
    } catch (err) {
        console.warn('TTS failed, using browser speech synthesis:', err);
    }

    // Fallback: browser speech synthesis
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getDetectedLanguage();
    utterance.rate = 1.0;
    speechSynthesis.speak(utterance);

    await new Promise((resolve) => {
        utterance.onend = resolve;
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the app
main().catch(console.error);
```

- [ ] **Step 2: Verify the full frontend manually**

Start the backend: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000`
Open `frontend/index.html` in Chrome. Verify the flow: consent → loading → avatar appears.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/app.js
git commit -m "feat: add main app orchestrator connecting all frontend modules"
```

---

## Task 18: Docker & Kubernetes Manifests

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `k8s/namespace.yaml`
- Create: `k8s/frontend/deployment.yaml`
- Create: `k8s/frontend/service.yaml`
- Create: `k8s/api-gateway/deployment.yaml`
- Create: `k8s/api-gateway/service.yaml`
- Create: `k8s/ollama/deployment.yaml`
- Create: `k8s/ollama/service.yaml`
- Create: `k8s/ollama/init-job.yaml`
- Create: `k8s/openvoice/deployment.yaml`
- Create: `k8s/openvoice/service.yaml`
- Create: `k8s/kustomization.yaml`

- [ ] **Step 1: Create backend Dockerfile**

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create frontend nginx.conf and Dockerfile**

```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api-gateway:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```dockerfile
# frontend/Dockerfile
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80
```

- [ ] **Step 3: Create K8s namespace**

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: karatly
```

- [ ] **Step 4: Create frontend K8s manifests**

```yaml
# k8s/frontend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: karatly
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: karatly-frontend:latest
          imagePullPolicy: Never
          ports:
            - containerPort: 80
          resources:
            limits:
              memory: "128Mi"
              cpu: "100m"
```

```yaml
# k8s/frontend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: karatly
spec:
  type: NodePort
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
```

- [ ] **Step 5: Create api-gateway K8s manifests**

```yaml
# k8s/api-gateway/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: karatly
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
        - name: api-gateway
          image: karatly-backend:latest
          imagePullPolicy: Never
          ports:
            - containerPort: 8000
          env:
            - name: OLLAMA_BASE_URL
              value: "http://ollama:11434"
            - name: OPENVOICE_BASE_URL
              value: "http://openvoice:5000"
            - name: GEMINI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: karatly-secrets
                  key: gemini-api-key
                  optional: true
          resources:
            limits:
              memory: "512Mi"
              cpu: "500m"
```

```yaml
# k8s/api-gateway/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: karatly
spec:
  type: ClusterIP
  selector:
    app: api-gateway
  ports:
    - port: 8000
      targetPort: 8000
```

- [ ] **Step 6: Create ollama K8s manifests**

```yaml
# k8s/ollama/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
  namespace: karatly
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
        - name: ollama
          image: ollama/ollama:latest
          ports:
            - containerPort: 11434
          resources:
            limits:
              memory: "10Gi"
              cpu: "4"
          volumeMounts:
            - name: ollama-data
              mountPath: /root/.ollama
      volumes:
        - name: ollama-data
          hostPath:
            path: /tmp/ollama-data
            type: DirectoryOrCreate
```

```yaml
# k8s/ollama/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: ollama
  namespace: karatly
spec:
  type: ClusterIP
  selector:
    app: ollama
  ports:
    - port: 11434
      targetPort: 11434
```

```yaml
# k8s/ollama/init-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: ollama-pull-gemma4
  namespace: karatly
spec:
  template:
    spec:
      containers:
        - name: pull
          image: curlimages/curl:latest
          command:
            - sh
            - -c
            - |
              echo "Waiting for Ollama to start..."
              until curl -s http://ollama:11434/ > /dev/null 2>&1; do
                sleep 2
              done
              echo "Pulling gemma4 model..."
              curl -X POST http://ollama:11434/api/pull -d '{"name": "gemma4"}'
              echo "Done."
      restartPolicy: OnFailure
  backoffLimit: 3
```

- [ ] **Step 7: Create openvoice K8s manifests**

```yaml
# k8s/openvoice/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openvoice
  namespace: karatly
spec:
  replicas: 1
  selector:
    matchLabels:
      app: openvoice
  template:
    metadata:
      labels:
        app: openvoice
    spec:
      containers:
        - name: openvoice
          image: karatly-openvoice:latest
          imagePullPolicy: Never
          ports:
            - containerPort: 5000
          resources:
            limits:
              memory: "4Gi"
              cpu: "2"
```

```yaml
# k8s/openvoice/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: openvoice
  namespace: karatly
spec:
  type: ClusterIP
  selector:
    app: openvoice
  ports:
    - port: 5000
      targetPort: 5000
```

- [ ] **Step 8: Create kustomization.yaml**

```yaml
# k8s/kustomization.yaml
apiVersion: kustomize.build/v1beta1
kind: Kustomization

resources:
  - namespace.yaml
  - frontend/deployment.yaml
  - frontend/service.yaml
  - api-gateway/deployment.yaml
  - api-gateway/service.yaml
  - ollama/deployment.yaml
  - ollama/service.yaml
  - ollama/init-job.yaml
  - openvoice/deployment.yaml
  - openvoice/service.yaml
```

- [ ] **Step 9: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile frontend/nginx.conf k8s/
git commit -m "feat: add Dockerfiles and Kubernetes manifests for all pods"
```

---

## Task 19: Docker Compose for Dev

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: "3.9"

services:
  frontend:
    build: ./frontend
    ports:
      - "30080:80"
    depends_on:
      - api-gateway

  api-gateway:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - OPENVOICE_BASE_URL=http://openvoice:5000
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
    depends_on:
      - ollama
      - openvoice

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama

  openvoice:
    build: ./openvoice-server
    ports:
      - "5000:5000"

volumes:
  ollama-data:
```

- [ ] **Step 2: Verify docker-compose config**

Run: `docker-compose config`
Expected: valid YAML output with all four services.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose.yml for local dev without Kubernetes"
```

---

## Task 20: Integration Smoke Test

**Files:** (no new files — testing existing setup)

- [ ] **Step 1: Build and start with docker-compose**

Run:
```bash
docker-compose build
docker-compose up -d
```

Expected: all four containers start.

- [ ] **Step 2: Verify health endpoints**

Run:
```bash
curl http://localhost:8000/health
```
Expected: `{"status":"ok"}`

Run:
```bash
curl http://localhost:11434/
```
Expected: `Ollama is running`

- [ ] **Step 3: Pull gemma4 model**

Run:
```bash
docker-compose exec ollama ollama pull gemma4
```
Expected: model downloads successfully.

- [ ] **Step 4: Open frontend in browser**

Navigate to `http://localhost:30080`. Verify:
1. Consent screen appears
2. Clicking "Allow" triggers camera permission prompt
3. After camera access, loading screen appears
4. Avatar generation starts (may fail on face analysis if model isn't ready — that's expected for first run)

- [ ] **Step 5: Run backend tests**

Run:
```bash
cd backend && python -m pytest -v
```
Expected: all tests PASS.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "chore: integration smoke test verified"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Project scaffolding | pyproject.toml, requirements.txt, config.py |
| 2 | Pydantic schemas | schemas.py, test_schemas.py |
| 3 | Persona service | persona.py, test_persona.py |
| 4 | Ollama client | ollama_client.py, test_ollama_client.py |
| 5 | Gemini fallback | gemini_client.py |
| 6 | OpenVoice client | openvoice_client.py |
| 7 | Face analysis router | face.py, test_face_router.py, main.py |
| 8 | Chat router | chat.py, test_chat_router.py |
| 9 | Voice router | voice.py, test_voice_router.py |
| 10 | OpenVoice server | server.py, Dockerfile, requirements.txt |
| 11 | Frontend HTML + consent | index.html, styles.css, consent.js |
| 12 | Camera + MediaPipe | camera.js, face-mesh.js |
| 13 | API client | api-client.js |
| 14 | Three.js avatar | avatar.js |
| 15 | Avatar animation | avatar-animation.js |
| 16 | Speech + audio | speech.js, audio-player.js |
| 17 | Main app orchestrator | app.js |
| 18 | Docker + K8s manifests | Dockerfiles, nginx.conf, k8s/*.yaml |
| 19 | Docker Compose | docker-compose.yml |
| 20 | Integration smoke test | (verification only) |
