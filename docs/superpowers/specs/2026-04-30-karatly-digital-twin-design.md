# Karatly.in — Digital Twin Conversational Avatar

**Date:** 2026-04-30
**Status:** Draft

---

## Overview

Karatly.in is a web application that uses the camera to see the user, generates a 3D digital avatar that resembles them, clones their voice, and engages them in an adaptive spoken conversation — all with no inputs beyond consent.

## User Flow

1. User opens `karatly.in` — sees a consent screen: "This experience uses your camera and microphone. Allow?"
2. On consent — camera activates, captures the user's face
3. Face is analyzed (gemma4 vision via Ollama, fallback to Gemini API) — extracts facial features (skin tone, face shape, hair, eye color, etc.)
4. A 3D avatar is generated in Three.js that resembles the user
5. The user's first 5-10 seconds of speech are captured for voice cloning
6. The avatar "comes alive" — introduces itself, starts conversation in the user's detected language
7. Conversation flows naturally — avatar adapts personality as it learns about the user
8. Session data (personality profile, conversation context) is kept in-memory for the session

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    BROWSER (Client)                  │
│                                                      │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Camera   │  │ MediaPipe │  │ Three.js Avatar  │  │
│  │ Feed     │→ │ Face Mesh │→ │ (3D face + lipsync│  │
│  └──────────┘  └───────────┘  │  + expressions)  │  │
│                                └──────────────────┘  │
│  ┌──────────────┐  ┌─────────────────────────────┐  │
│  │ Web Speech   │  │ Audio Playback              │  │
│  │ API (STT)    │  │ (cloned voice response)     │  │
│  └──────┬───────┘  └─────────────▲───────────────┘  │
│         │                        │                   │
└─────────┼────────────────────────┼───────────────────┘
          │ user speech text       │ audio stream
          ▼                        │
┌─────────────────────────────────────────────────────┐
│               KUBERNETES (Local)                     │
│                                                      │
│  ┌─────────────────┐    ┌──────────────────────┐    │
│  │  API Gateway     │    │  Ollama (gemma4)     │    │
│  │  (FastAPI)       │←──│  - Conversation      │    │
│  │                  │──→│  - Face analysis      │    │
│  │                  │    │  - Language detection │    │
│  └────────┬─────────┘    └──────────────────────┘    │
│           │                                          │
│           │ fallback        ┌──────────────────────┐ │
│           │────────────────→│  Gemini API (only    │ │
│           │                 │  if gemma4 face      │ │
│           │                 │  analysis fails)     │ │
│           │                 └──────────────────────┘ │
│           │                                          │
│           ▼                                          │
│  ┌──────────────────────┐                            │
│  │  OpenVoice TTS       │                            │
│  │  - Voice cloning     │                            │
│  │  - Speech synthesis  │                            │
│  └──────────────────────┘                            │
└─────────────────────────────────────────────────────┘
```

### Pods (namespace: karatly)

| Pod | Image | Port | Resources | Role |
|-----|-------|------|-----------|------|
| frontend | nginx:alpine | 80 (NodePort 30080) | 128MB RAM, 0.1 CPU | Serves static web app |
| api-gateway | python:3.12-slim | 8000 (ClusterIP) | 512MB RAM, 0.5 CPU | FastAPI orchestrator |
| ollama | ollama/ollama:latest | 11434 (ClusterIP) | 8GB+ RAM, GPU | gemma4 model |
| openvoice | custom Dockerfile | 5000 (ClusterIP) | 4GB RAM, GPU shared | Voice cloning + TTS |

### Startup Order

1. Ollama starts, pulls gemma4 if not cached
2. OpenVoice starts, loads model weights
3. API gateway starts, health-checks both services
4. Frontend starts, ready to serve

### GPU Sharing

Ollama and OpenVoice time-share a single GPU via Docker Desktop GPU passthrough. They are not used simultaneously — voice synthesis happens after conversation inference completes.

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Vanilla JS + Three.js + MediaPipe | No framework overhead, direct WebGL control |
| 3D Avatar | Three.js + MediaPipe Face Landmarker | 468 face landmarks, realistic mesh, client-side |
| Lip Sync | Viseme mapping from TTS phoneme output | Sync avatar mouth shapes to speech audio |
| STT | Web Speech API | Free, 100+ languages, no server pod needed |
| Backend API | Python FastAPI | Lightweight, async, streaming support |
| Conversation | Ollama (gemma4) | Local, free, multimodal, adaptive personality |
| Face Analysis | Ollama (gemma4) vision; fallback Gemini API | Extract appearance features from camera frame |
| Voice Cloning | OpenVoice v2 | Open source, few-second clone, multilingual |
| TTS | OpenVoice v2 | Same service, synthesis with cloned voice |
| Containers | Docker + Kubernetes (Docker Desktop) | Local orchestration |
| Language Detection | Web Speech API locale | Auto-detected from browser, no user input |

## Conversation & Personality System

### Adaptive Persona State

```
PersonaState {
  tone: "friendly" → adapts (playful / professional / empathetic / etc.)
  interests_discovered: []
  user_profile: {}
  conversation_style: "casual"
  humor_level: 0.5
  language: "auto-detected"
}
```

### Adaptation Flow

1. **First 30 seconds** — warm and curious, asks a light open-ended question
2. **After 2-3 exchanges** — gemma4 analyzes user's tone, vocabulary, topics to adjust personality
3. **Ongoing** — every 5 messages, a background prompt updates persona state
4. **Session memory** — full conversation + persona state maintained in context

### System Prompt for gemma4

```
You are a digital companion who looks like the user.
Current persona: {persona_state}
User profile so far: {user_profile}
Language: {detected_language}

Rules:
- Never ask for typed input — this is voice-only
- Respond naturally in the user's language
- Keep responses concise (2-3 sentences) for natural conversation flow
- Adapt your tone to match the user's energy
- Be entertaining but genuine
- Learn about the user organically — don't interrogate
```

Responses are capped at 2-3 sentences for natural spoken conversation pacing.

## Avatar Rendering Pipeline

### Stage 1: Face Capture & Analysis

1. Camera feed → MediaPipe Face Landmarker extracts 468 3D face landmarks in real-time
2. A single high-quality frame is sent to gemma4 vision: "Describe this person's appearance: skin tone (hex color), hair color, hair style, eye color, face shape, approximate age range, any facial hair or glasses"
3. Response parsed into AvatarConfig

### Stage 2: 3D Face Generation

```
AvatarConfig {
  face_geometry: Float32Array    // from MediaPipe landmarks
  skin_color: "#D2A67D"
  hair_color: "#3B2417"
  hair_style: "short_wavy"
  eye_color: "#5B4C3A"
  has_glasses: true
  has_facial_hair: false
}
```

- Base head mesh deformed to match MediaPipe landmark positions
- Materials applied from gemma4 color analysis (skin, hair, eyes)
- Hair selected from pre-modeled styles, colored to match
- Glasses/facial hair added as optional mesh attachments

### Stage 3: Animation

| Animation | Source | Method |
|-----------|--------|--------|
| Idle | Procedural | Breathing, blinking (2-6s random), micro head sway |
| Lip sync | TTS phoneme data | Phonemes → viseme mapping → mouth morph targets |
| Expressions | Conversation sentiment | gemma4 tags emotion → blend shape presets |

### Rendering

- Three.js with PBR materials, soft lighting
- Stylized-realistic look (Pixar-like, avoids uncanny valley)
- Target: 30fps on mid-range hardware
- All rendering client-side via WebGL

## Voice Cloning & Speech Flow

### Voice Cloning Pipeline

1. Avatar greets user with a default neutral voice
2. First 5-10 seconds of user speech captured as WAV buffer
3. Audio sent to OpenVoice pod → extracts voice embedding (tone, pitch, cadence)
4. All subsequent TTS uses the cloned voice profile
5. **Fallback:** If voice cloning fails or audio quality is too low, the avatar continues with the default neutral voice

### End-to-End Speech Flow

```
User speaks
    → Web Speech API (browser) → text + detected language
    → FastAPI gateway → Ollama gemma4
    → gemma4 responds: { text: "...", emotion: "amused" }
    → Text + voice embedding → OpenVoice TTS pod
    → Audio stream → browser
    → Audio plays + viseme data drives lip sync
    → Avatar expression set to "amused"
```

### Latency Budget (target < 2 seconds)

| Step | Target |
|------|--------|
| STT (browser) | ~200ms (real-time) |
| Network to gateway | ~10ms (local K8s) |
| gemma4 response | ~800ms (streaming first tokens) |
| OpenVoice TTS | ~500ms |
| Audio playback start | ~100ms |
| **Total** | **~1.6s** |

### Streaming Optimization

gemma4 streams tokens. As soon as the first sentence is complete, it is sent to OpenVoice for synthesis while gemma4 continues generating. Audio starts before the full response is generated.

### Multilingual Voice

OpenVoice v2 supports multilingual synthesis. The cloned voice embedding is language-agnostic — it captures voice quality, not language. The avatar speaks back in whatever language was detected.

## Kubernetes Deployment

### Run Command

```bash
kubectl apply -k ./k8s/
```

### Access

- Frontend: `http://localhost:30080`

### Dev Convenience

A `docker-compose.yml` is provided for quick local dev without K8s.

## Non-Goals (Explicitly Out of Scope)

- Persistent user accounts or login
- Database storage of conversations
- Production cloud deployment
- Mobile-optimized UI
- Multi-user sessions
- Photorealistic avatar (stylized-realistic is the target)
