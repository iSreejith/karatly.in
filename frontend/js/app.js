// frontend/js/app.js
import { initConsent, showScreen, setLoadingStatus } from './consent.js';
import { initCamera, initAudio, captureFrame, getAudioStream, stopCamera } from './camera.js';
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
    setMicStream,
} from './speech.js';
import { initAudioPlayer, playAudio } from './audio-player.js';
import { analyzeFace, startChat, sendChat, cloneVoice, speak } from './api-client.js';

let sessionId = null;
let isProcessing = false;

async function main() {
    try {
        // Step 1: Wait for consent
        await initConsent();

        // Step 2: Show loading, initialize camera (video only, no mic)
        showScreen('loading-screen');

        setLoadingStatus('Starting camera...');
        const videoElement = await initCamera();

        // Step 3: Try face detection (skip if it takes too long)
        setLoadingStatus('Loading face detection...');
        let faceData = null;
        try {
            await initFaceMesh();
            setLoadingStatus('Looking for your face...');
            for (let attempt = 0; attempt < 15; attempt++) {
                faceData = detectFace(videoElement, performance.now());
                if (faceData) break;
                await sleep(300);
            }
        } catch (err) {
            console.warn('Face mesh init failed, skipping:', err);
        }

        // Step 4: Analyze face (with timeout)
        setLoadingStatus('Analyzing your face...');
        const frameBase64 = captureFrame();
        let avatarConfig;
        try {
            const analysis = await Promise.race([
                analyzeFace(frameBase64),
                sleep(15000).then(() => { throw new Error('Face analysis timeout'); }),
            ]);
            avatarConfig = analysis.avatar_config;
            console.log('Face analysis result:', avatarConfig);
        } catch (err) {
            console.warn('Face analysis failed, using defaults:', err);
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

        // Step 5: Switch to avatar screen so canvas gets dimensions
        const language = getDetectedLanguage() || navigator.language?.split('-')[0] || 'en';
        document.getElementById('language-indicator').textContent = language.toUpperCase();
        showScreen('avatar-screen');
        await sleep(200);

        // Step 6: Build 3D avatar
        const canvas = document.getElementById('avatar-canvas');
        console.log('Canvas size:', canvas.clientWidth, canvas.clientHeight);
        initAvatar(canvas);
        buildAvatar(avatarConfig, faceData?.landmarks);
        startAnimationLoop();
        console.log('Avatar built and animation started');

        // Step 7: Initialize audio playback
        initAudioPlayer();

        // Step 8: Start chat — get initial greeting (NO mic yet)
        try {
            const greeting = await startChat(language);
            sessionId = greeting.session_id;
            console.log('Greeting:', greeting.text);
            setAvatarEmotion(greeting.emotion);
            await sayText(greeting.text, greeting.emotion);
        } catch (err) {
            console.error('Chat start failed:', err);
        }

        // Step 9: NOW enable the microphone
        try {
            const rawAudioStream = await initAudio();
            setMicStream(rawAudioStream);
        } catch (err) {
            console.warn('Mic init failed:', err);
        }
        const audioStream = getAudioStream();

        // Step 10: Voice cloning in background
        if (audioStream) {
            startAudioRecording(audioStream).then(async (audioBase64) => {
                if (sessionId) {
                    try {
                        await cloneVoice(audioBase64, sessionId);
                        console.log('Voice cloned successfully');
                    } catch (err) {
                        console.warn('Voice cloning failed:', err);
                    }
                }
            });
        }

        // Step 11: Start listening
        initSpeechRecognition(onUserSpeech, (err) => {
            console.warn('Speech recognition error:', err);
        });
        startListening();

    } catch (err) {
        console.error('App initialization failed:', err);
        setLoadingStatus('Something went wrong. Check console for details.');
    }
}

async function onUserSpeech(text, language) {
    if (isProcessing || !sessionId) return;
    isProcessing = true;
    pauseListening();

    try {
        const response = await sendChat(text, language, sessionId);
        setAvatarEmotion(response.emotion);
        await sayText(response.text, response.emotion);
    } catch (err) {
        console.error('Chat error:', err);
    }

    isProcessing = false;
    resumeListening();
}

async function sayText(text, emotion) {
    pauseListening();
    speakText(text, emotion);

    // Try TTS service first
    try {
        const audioData = await speak(text, getDetectedLanguage(), sessionId);
        if (audioData) {
            await playAudio(audioData);
            resumeListening();
            return;
        }
    } catch (err) {
        // TTS unavailable, fall through to browser synthesis
    }

    // Fallback: browser speech synthesis
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getDetectedLanguage();
    utterance.rate = 1.0;
    speechSynthesis.speak(utterance);

    await new Promise((resolve) => {
        utterance.onend = resolve;
        // Safety timeout in case onend never fires
        setTimeout(resolve, 10000);
    });

    resumeListening();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
