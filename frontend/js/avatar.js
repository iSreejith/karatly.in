// frontend/js/avatar.js — 2D photo-based avatar

let photoEl = null;
let glowEl = null;
let textEl = null;

export function initAvatar() {
    photoEl = document.getElementById('avatar-photo');
    glowEl = document.getElementById('avatar-glow');
    textEl = document.getElementById('avatar-text');
}

export function setAvatarPhoto(base64Jpeg) {
    if (photoEl) {
        photoEl.src = 'data:image/jpeg;base64,' + base64Jpeg;
    }
}

export function setSpeaking(isSpeaking) {
    if (!photoEl || !glowEl) return;
    if (isSpeaking) {
        photoEl.classList.add('speaking');
        photoEl.classList.remove('listening');
        glowEl.classList.add('speaking');
        glowEl.classList.remove('listening');
    } else {
        photoEl.classList.remove('speaking');
        glowEl.classList.remove('speaking');
    }
}

export function setListening(isListening) {
    if (!photoEl || !glowEl) return;
    if (isListening) {
        photoEl.classList.add('listening');
        photoEl.classList.remove('speaking');
        glowEl.classList.add('listening');
        glowEl.classList.remove('speaking');
    } else {
        photoEl.classList.remove('listening');
        glowEl.classList.remove('listening');
    }
}

export function showText(text) {
    if (!textEl) return;
    textEl.textContent = text;
    textEl.classList.add('visible');
}

export function hideText() {
    if (!textEl) return;
    textEl.classList.remove('visible');
}
