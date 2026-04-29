// frontend/js/camera.js

let videoElement = null;
let stream = null;

export async function initCamera() {
    videoElement = document.getElementById('camera-feed');
    stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true,
    });
    videoElement.srcObject = stream;
    await new Promise((resolve) => {
        videoElement.onloadedmetadata = resolve;
    });
    return videoElement;
}

export function captureFrame() {
    if (!videoElement) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);
    // Return base64 without the data:image/... prefix
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

export function getAudioStream() {
    if (!stream) return null;
    return new MediaStream(stream.getAudioTracks());
}

export function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}
