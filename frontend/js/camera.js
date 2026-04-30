// frontend/js/camera.js

let videoElement = null;
let videoStream = null;
let audioStream = null;

export async function initCamera() {
    videoElement = document.getElementById('camera-feed');
    // Only request video for face analysis — no audio yet
    videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
    });
    videoElement.srcObject = videoStream;
    await new Promise((resolve) => {
        videoElement.onloadedmetadata = resolve;
    });
    return videoElement;
}

export async function initAudio() {
    // Request audio separately, only when needed
    audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
    });
    // Mute all tracks by default — only enable when actively recording
    audioStream.getAudioTracks().forEach(track => { track.enabled = false; });
    return audioStream;
}

export function captureFrame() {
    if (!videoElement) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

export function getAudioStream() {
    if (!audioStream) return null;
    return new MediaStream(audioStream.getAudioTracks());
}

export function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}
