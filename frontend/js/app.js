// frontend/js/app.js
import { initConsent, showScreen, setLoadingStatus } from './consent.js';
import { initCamera, initAudio, captureFrame, getAudioStream } from './camera.js';
import { initAvatar, setAvatarPhoto, setSpeaking, setListening, showText, hideText } from './avatar.js';
import {
    initSpeechRecognition,
    startListening,
    pauseListening,
    resumeListening,
    getDetectedLanguage,
    setMicStream,
} from './speech.js';
import { initAudioPlayer, playAudio } from './audio-player.js';
import { startChat, sendChat, speak } from './api-client.js';

let sessionId = null;
let isProcessing = false;

async function main() {
    try {
        // Step 1: Wait for consent
        await initConsent();

        // Step 2: Camera (video only)
        showScreen('loading-screen');
        setLoadingStatus('Starting camera...');
        await initCamera();

        // Step 3: Capture face photo — wait for camera to actually produce frames
        setLoadingStatus('Capturing your photo...');
        const video = document.getElementById('camera-feed');
        // Wait until the video has real frames
        for (let i = 0; i < 20; i++) {
            if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) break;
            await sleep(250);
        }
        await sleep(500); // extra settle time
        const photoBase64 = captureFrame();

        // Step 4: Show avatar screen with photo
        initAvatar();
        if (photoBase64) {
            setAvatarPhoto(photoBase64);
        } else {
            // Fallback: show a placeholder gradient circle
            const el = document.getElementById('avatar-photo');
            el.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
            el.style.border = '3px solid rgba(99, 102, 241, 0.6)';
        }
        const language = navigator.language?.split('-')[0] || 'en';
        document.getElementById('language-indicator').textContent = language.toUpperCase();
        showScreen('avatar-screen');

        // Step 5: Initialize audio playback
        initAudioPlayer();

        // Step 6: Get greeting from AI (no mic yet)
        setLoadingStatus('Starting conversation...');
        try {
            const greeting = await startChat(language);
            sessionId = greeting.session_id;
            await sayText(greeting.text);
        } catch (err) {
            console.error('Chat start failed:', err);
        }

        // Step 7: Enable mic after greeting
        try {
            const rawAudioStream = await initAudio();
            setMicStream(rawAudioStream);
        } catch (err) {
            console.warn('Mic init failed:', err);
        }

        // Step 8: Start listening
        initSpeechRecognition(onUserSpeech, (err) => {
            console.warn('Speech recognition error:', err);
        });
        startListening();
        setListening(true);

    } catch (err) {
        console.error('App failed:', err);
        setLoadingStatus('Something went wrong: ' + err.message);
    }
}

async function onUserSpeech(text, language) {
    if (isProcessing || !sessionId) return;
    isProcessing = true;
    pauseListening();
    setListening(false);
    showText('You: ' + text);

    try {
        const response = await sendChat(text, language, sessionId);
        await sayText(response.text);
    } catch (err) {
        console.error('Chat error:', err);
    }

    isProcessing = false;
    hideText();
    resumeListening();
    setListening(true);
}

async function sayText(text) {
    pauseListening();
    setListening(false);
    setSpeaking(true);
    showText(text);

    // Try TTS service
    try {
        const audioData = await speak(text, getDetectedLanguage(), sessionId);
        if (audioData) {
            await playAudio(audioData);
            setSpeaking(false);
            resumeListening();
            setListening(true);
            return;
        }
    } catch (err) {
        // TTS unavailable, use browser synthesis
    }

    // Fallback: browser speech synthesis
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getDetectedLanguage();
    utterance.rate = 1.0;
    speechSynthesis.speak(utterance);

    await new Promise((resolve) => {
        utterance.onend = resolve;
        setTimeout(resolve, 15000);
    });

    setSpeaking(false);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
