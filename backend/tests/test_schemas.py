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
