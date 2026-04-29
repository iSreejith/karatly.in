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

        setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        }, 8000);
    });
}
