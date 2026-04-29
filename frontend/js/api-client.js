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
