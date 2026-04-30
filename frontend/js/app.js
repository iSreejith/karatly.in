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

    // Step 5: Switch to avatar screen FIRST so canvas has dimensions
    setLoadingStatus('Creating your avatar...');
    const language = getDetectedLanguage() || navigator.language?.split('-')[0] || 'en';
    document.getElementById('language-indicator').textContent = language.toUpperCase();
    showScreen('avatar-screen');

    // Small delay to let the browser layout the canvas
    await sleep(100);

    // Step 6: Build 3D avatar (canvas now has real dimensions)
    const canvas = document.getElementById('avatar-canvas');
    initAvatar(canvas);
    buildAvatar(avatarConfig, faceData?.landmarks);
    startAnimationLoop();

    // Step 7: Initialize audio
    initAudioPlayer();

    // Step 8: Start voice cloning in background
    const audioStream = getAudioStream();
    let voiceClonePromise = null;

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
    // Pause mic so it doesn't pick up the avatar's speech
    pauseListening();

    // Start lip sync animation
    speakText(text, emotion);

    // Try to get TTS audio
    try {
        const audioData = await speak(text, getDetectedLanguage(), sessionId);
        if (audioData) {
            await playAudio(audioData);
            resumeListening();
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

    // Resume mic after speaking is done
    resumeListening();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the app
main().catch(console.error);
