// frontend/js/audio-player.js

let audioContext = null;

export function initAudioPlayer() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

export async function playAudio(audioArrayBuffer) {
    if (!audioContext) initAudioPlayer();

    try {
        const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);

        return new Promise((resolve) => {
            source.onended = resolve;
        });
    } catch (err) {
        console.error('Audio playback failed:', err);
        const blob = new Blob([audioArrayBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        return new Promise((resolve) => {
            audio.onended = () => {
                URL.revokeObjectURL(url);
                resolve();
            };
            audio.play().catch(resolve);
        });
    }
}

export function getAudioDuration(audioArrayBuffer) {
    if (!audioContext) initAudioPlayer();
    return audioContext.decodeAudioData(audioArrayBuffer.slice(0))
        .then(buffer => buffer.duration)
        .catch(() => 2.0);
}
