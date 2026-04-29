import os
import io
import base64
import uuid
import logging
import numpy as np
from fastapi import FastAPI
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI(title="OpenVoice TTS Server")
logger = logging.getLogger("openvoice-server")

# Global state for voice embeddings per session
voice_embeddings: dict[str, object] = {}
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
    global tts_model, tone_converter
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
        return Response(content='{"detail": "Models not loaded"}', status_code=503, media_type="application/json")

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

        return Response(content=audio_data, media_type="audio/wav")

    except Exception as e:
        logger.error(f"TTS failed: {e}")
        return Response(content=f'{{"detail": "{str(e)}"}}', status_code=500, media_type="application/json")
