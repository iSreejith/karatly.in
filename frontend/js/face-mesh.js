// frontend/js/face-mesh.js

let faceLandmarker = null;

export async function initFaceMesh() {
    const { FaceLandmarker, FilesetResolver } = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs'
    );

    const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
    });
}

export function detectFace(videoElement, timestampMs) {
    if (!faceLandmarker) return null;
    const results = faceLandmarker.detectForVideo(videoElement, timestampMs);
    if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
        return null;
    }
    return {
        landmarks: results.faceLandmarks[0],
        blendshapes: results.faceBlendshapes?.[0]?.categories || [],
        transformMatrix: results.facialTransformationMatrixes?.[0] || null,
    };
}

export function getLandmarkPositions(landmarks) {
    const positions = new Float32Array(landmarks.length * 3);
    for (let i = 0; i < landmarks.length; i++) {
        positions[i * 3] = landmarks[i].x;
        positions[i * 3 + 1] = landmarks[i].y;
        positions[i * 3 + 2] = landmarks[i].z;
    }
    return positions;
}
