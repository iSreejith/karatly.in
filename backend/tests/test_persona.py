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
