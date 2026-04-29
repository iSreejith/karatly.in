// frontend/js/consent.js

export function initConsent() {
    return new Promise((resolve) => {
        const btn = document.getElementById('consent-btn');
        btn.addEventListener('click', () => {
            resolve();
        }, { once: true });
    });
}

export function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

export function setLoadingStatus(message) {
    document.getElementById('loading-status').textContent = message;
}
