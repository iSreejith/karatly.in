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
