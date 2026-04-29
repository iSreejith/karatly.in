// frontend/js/avatar-animation.js
import { getHeadMesh, setExpression, setViseme, renderFrame } from './avatar.js';

let animationId = null;
let blinkTimer = 0;
let nextBlinkTime = 2000 + Math.random() * 4000;
let breathPhase = 0;
let headSwayPhase = 0;
let isSpeaking = false;
let currentVisemeIndex = 0;
let visemeSequence = [];
let visemeStartTime = 0;
let currentEmotion = 'friendly';

const CHAR_TO_VISEME = {
    'a': 'aa', 'e': 'ee', 'i': 'ih', 'o': 'oh', 'u': 'oo',
    'b': 'pp', 'p': 'pp', 'm': 'pp',
    'f': 'ff', 'v': 'ff',
    't': 'dd', 'd': 'dd', 'l': 'dd', 'n': 'nn',
    'k': 'kk', 'g': 'kk',
    's': 'ss', 'z': 'ss',
    'r': 'rr',
    'ch': 'ch', 'sh': 'ch', 'j': 'ch',
    'th': 'th',
};

export function startAnimationLoop() {
    let lastTime = 0;

    function animate(time) {
        const delta = time - lastTime;
        lastTime = time;

        updateIdle(time, delta);

        if (isSpeaking) {
            updateLipSync(time);
        }

        renderFrame();
        animationId = requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);
}

export function stopAnimationLoop() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

function updateIdle(time, delta) {
    const head = getHeadMesh();
    if (!head) return;

    breathPhase += delta * 0.002;
    const breathAmount = Math.sin(breathPhase) * 0.005;
    head.position.y = breathAmount;

    headSwayPhase += delta * 0.0005;
    head.rotation.y = Math.sin(headSwayPhase) * 0.03;
    head.rotation.x = Math.sin(headSwayPhase * 0.7) * 0.01;

    blinkTimer += delta;
    if (blinkTimer >= nextBlinkTime) {
        blink(head);
        blinkTimer = 0;
        nextBlinkTime = 2000 + Math.random() * 4000;
    }
}

function blink(head) {
    const eyes = head.children.filter(c => c.geometry?.parameters?.radius === 0.09);
    eyes.forEach(eye => {
        eye.scale.y = 0.1;
        setTimeout(() => { eye.scale.y = 1; }, 150);
    });
}

function updateLipSync(time) {
    if (visemeSequence.length === 0) return;

    const elapsed = time - visemeStartTime;
    const visemeDuration = 80;
    const index = Math.floor(elapsed / visemeDuration);

    if (index >= visemeSequence.length) {
        isSpeaking = false;
        setViseme('silent');
        setExpression(currentEmotion);
        return;
    }

    if (index !== currentVisemeIndex) {
        currentVisemeIndex = index;
        setViseme(visemeSequence[index]);
    }
}

export function speakText(text, emotion) {
    currentEmotion = emotion || 'neutral';
    setExpression(emotion);

    visemeSequence = textToVisemes(text);
    currentVisemeIndex = -1;
    visemeStartTime = performance.now();
    isSpeaking = true;
}

export function setAvatarEmotion(emotion) {
    currentEmotion = emotion;
    if (!isSpeaking) {
        setExpression(emotion);
    }
}

function textToVisemes(text) {
    const visemes = [];
    const lower = text.toLowerCase().replace(/[^a-z ]/g, '');

    for (let i = 0; i < lower.length; i++) {
        const char = lower[i];
        if (char === ' ') {
            visemes.push('silent');
        } else {
            const digraph = lower.substring(i, i + 2);
            if (CHAR_TO_VISEME[digraph]) {
                visemes.push(CHAR_TO_VISEME[digraph]);
                i++;
            } else if (CHAR_TO_VISEME[char]) {
                visemes.push(CHAR_TO_VISEME[char]);
            } else {
                visemes.push('dd');
            }
        }
    }

    return visemes;
}
