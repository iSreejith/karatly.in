// frontend/js/avatar.js
import * as THREE from 'three';

let scene, camera, renderer, headMesh, leftEyeMesh, rightEyeMesh;
let hairMesh, glassesMesh;

// Blend shape morph targets for expressions
const EXPRESSION_MORPHS = {
    smile: { mouthSmile: 1.0, eyeSquint: 0.3 },
    surprised: { mouthOpen: 0.8, eyeWide: 0.7 },
    thinking: { browDown: 0.5, mouthPurse: 0.3 },
    amused: { mouthSmile: 0.7, eyeSquint: 0.2 },
    friendly: { mouthSmile: 0.4 },
    neutral: {},
    excited: { mouthSmile: 0.9, eyeWide: 0.4 },
    empathetic: { browUp: 0.3, mouthSmile: 0.2 },
};

// Viseme shapes for lip sync (maps phoneme categories to mouth morph weights)
const VISEME_MAP = {
    silent: { jawOpen: 0, mouthSmile: 0 },
    pp: { jawOpen: 0.05, lipPress: 0.8 },
    ff: { jawOpen: 0.1, lipBite: 0.6 },
    th: { jawOpen: 0.15, tongueOut: 0.4 },
    dd: { jawOpen: 0.2, tongueUp: 0.5 },
    kk: { jawOpen: 0.25, tongueBack: 0.5 },
    ch: { jawOpen: 0.2, lipPucker: 0.4 },
    ss: { jawOpen: 0.1, lipStretch: 0.5 },
    nn: { jawOpen: 0.15, tongueUp: 0.3 },
    rr: { jawOpen: 0.2, lipPucker: 0.3 },
    aa: { jawOpen: 0.6, mouthStretch: 0.3 },
    ee: { jawOpen: 0.3, lipStretch: 0.6 },
    ih: { jawOpen: 0.35, lipStretch: 0.3 },
    oh: { jawOpen: 0.5, lipPucker: 0.5 },
    oo: { jawOpen: 0.3, lipPucker: 0.8 },
};

export function initAvatar(canvas) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(0, 0, 2.5);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Soft lighting setup
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
    fillLight.position.set(-2, 1, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);

    window.addEventListener('resize', () => {
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    });

    return { scene, camera, renderer };
}

export function buildAvatar(avatarConfig, landmarks) {
    // Clear previous avatar
    if (headMesh) scene.remove(headMesh);
    if (hairMesh) scene.remove(hairMesh);
    if (leftEyeMesh) scene.remove(leftEyeMesh);
    if (rightEyeMesh) scene.remove(rightEyeMesh);
    if (glassesMesh) scene.remove(glassesMesh);

    // --- Head ---
    const headGeometry = new THREE.SphereGeometry(0.55, 64, 48);

    // Deform sphere to match face shape
    if (avatarConfig.face_shape === 'round') {
        headGeometry.scale(1.0, 0.95, 0.95);
    } else if (avatarConfig.face_shape === 'square') {
        headGeometry.scale(1.0, 1.0, 0.9);
    } else if (avatarConfig.face_shape === 'heart') {
        headGeometry.scale(0.95, 1.05, 0.9);
    } else if (avatarConfig.face_shape === 'oblong') {
        headGeometry.scale(0.9, 1.1, 0.9);
    }

    // Setup morph targets for expressions
    setupMorphTargets(headGeometry);

    const skinMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(avatarConfig.skin_color),
        roughness: 0.7,
        metalness: 0.05,
    });

    headMesh = new THREE.Mesh(headGeometry, skinMaterial);
    headMesh.morphTargetInfluences = new Array(headGeometry.morphAttributes.position?.length || 8).fill(0);
    scene.add(headMesh);

    // --- Eyes ---
    const eyeGeometry = new THREE.SphereGeometry(0.06, 32, 32);
    const eyeMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(avatarConfig.eye_color),
        roughness: 0.3,
        metalness: 0.1,
    });

    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5f5f5,
        roughness: 0.3,
    });

    // Eye whites
    const leftEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 32), eyeWhiteMaterial);
    leftEyeWhite.position.set(-0.17, 0.08, 0.42);
    headMesh.add(leftEyeWhite);

    const rightEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 32), eyeWhiteMaterial);
    rightEyeWhite.position.set(0.17, 0.08, 0.42);
    headMesh.add(rightEyeWhite);

    // Irises
    leftEyeMesh = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEyeMesh.position.set(-0.17, 0.08, 0.48);
    headMesh.add(leftEyeMesh);

    rightEyeMesh = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEyeMesh.position.set(0.17, 0.08, 0.48);
    headMesh.add(rightEyeMesh);

    // Pupils
    const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const pupilGeometry = new THREE.SphereGeometry(0.03, 16, 16);

    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(0, 0, 0.04);
    leftEyeMesh.add(leftPupil);

    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0, 0, 0.04);
    rightEyeMesh.add(rightPupil);

    // --- Nose (subtle bump) ---
    const noseGeometry = new THREE.SphereGeometry(0.06, 16, 16);
    noseGeometry.scale(0.8, 0.6, 1.0);
    const noseMesh = new THREE.Mesh(noseGeometry, skinMaterial);
    noseMesh.position.set(0, -0.05, 0.52);
    headMesh.add(noseMesh);

    // --- Mouth (torus for lips) ---
    const mouthGeometry = new THREE.TorusGeometry(0.08, 0.02, 8, 16, Math.PI);
    const mouthMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(avatarConfig.skin_color).offsetHSL(0, 0.1, -0.1),
        roughness: 0.5,
    });
    const mouthMesh = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouthMesh.position.set(0, -0.18, 0.46);
    mouthMesh.rotation.x = Math.PI;
    headMesh.add(mouthMesh);

    // --- Hair ---
    buildHair(avatarConfig);

    // --- Glasses (optional) ---
    if (avatarConfig.has_glasses) {
        buildGlasses();
    }

    return headMesh;
}

function setupMorphTargets(geometry) {
    // Create morph target positions for facial expressions
    const positionAttribute = geometry.attributes.position;
    const count = positionAttribute.count;

    // jawOpen — lower vertices move down
    const jawOpen = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const y = positionAttribute.getY(i);
        if (y < -0.1) {
            jawOpen[i * 3 + 1] = -0.08;
        }
    }

    // mouthSmile — side vertices move up and outward
    const mouthSmile = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        const z = positionAttribute.getZ(i);
        if (y < 0 && y > -0.3 && z > 0.3) {
            mouthSmile[i * 3] = Math.sign(x) * 0.02;
            mouthSmile[i * 3 + 1] = 0.03;
        }
    }

    geometry.morphAttributes.position = [
        new THREE.Float32BufferAttribute(jawOpen, 3),
        new THREE.Float32BufferAttribute(mouthSmile, 3),
    ];
}

function buildHair(config) {
    const hairColor = new THREE.Color(config.hair_color);
    const hairMaterial = new THREE.MeshStandardMaterial({
        color: hairColor,
        roughness: 0.8,
        metalness: 0.05,
    });

    const style = config.hair_style || 'short_straight';

    if (style === 'bald') return;

    // Base hair cap
    const capGeometry = new THREE.SphereGeometry(0.57, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
    hairMesh = new THREE.Mesh(capGeometry, hairMaterial);
    hairMesh.position.set(0, 0.05, 0);

    // Extend hair based on length
    if (style.startsWith('long_')) {
        const backGeometry = new THREE.CylinderGeometry(0.35, 0.25, 0.6, 16, 1, true);
        const backHair = new THREE.Mesh(backGeometry, hairMaterial);
        backHair.position.set(0, -0.35, -0.15);
        hairMesh.add(backHair);
    } else if (style.startsWith('medium_')) {
        const backGeometry = new THREE.CylinderGeometry(0.4, 0.3, 0.3, 16, 1, true);
        const backHair = new THREE.Mesh(backGeometry, hairMaterial);
        backHair.position.set(0, -0.2, -0.1);
        hairMesh.add(backHair);
    }

    headMesh.add(hairMesh);
}

function buildGlasses() {
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.3,
        metalness: 0.7,
    });

    const lensMaterial = new THREE.MeshStandardMaterial({
        color: 0x88bbff,
        transparent: true,
        opacity: 0.15,
        roughness: 0.1,
    });

    // Left lens
    const lensGeometry = new THREE.RingGeometry(0.07, 0.09, 32);
    const leftFrame = new THREE.Mesh(lensGeometry, frameMaterial);
    leftFrame.position.set(-0.17, 0.08, 0.5);
    headMesh.add(leftFrame);

    const leftLens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), lensMaterial);
    leftLens.position.set(-0.17, 0.08, 0.5);
    headMesh.add(leftLens);

    // Right lens
    const rightFrame = new THREE.Mesh(lensGeometry, frameMaterial);
    rightFrame.position.set(0.17, 0.08, 0.5);
    headMesh.add(rightFrame);

    const rightLens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), lensMaterial);
    rightLens.position.set(0.17, 0.08, 0.5);
    headMesh.add(rightLens);

    // Bridge
    const bridgeGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8);
    const bridge = new THREE.Mesh(bridgeGeometry, frameMaterial);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.08, 0.5);
    headMesh.add(bridge);

    glassesMesh = leftFrame;
}

export function setExpression(emotionName) {
    if (!headMesh || !headMesh.morphTargetInfluences) return;
    // Reset all morph targets
    for (let i = 0; i < headMesh.morphTargetInfluences.length; i++) {
        headMesh.morphTargetInfluences[i] = 0;
    }
    // Apply emotion morphs (simplified — maps to jawOpen and mouthSmile)
    const morphs = EXPRESSION_MORPHS[emotionName] || EXPRESSION_MORPHS.neutral;
    if (morphs.mouthSmile) headMesh.morphTargetInfluences[1] = morphs.mouthSmile;
    if (morphs.mouthOpen || morphs.jawOpen) headMesh.morphTargetInfluences[0] = morphs.mouthOpen || morphs.jawOpen || 0;
}

export function setViseme(visemeName) {
    if (!headMesh || !headMesh.morphTargetInfluences) return;
    const viseme = VISEME_MAP[visemeName] || VISEME_MAP.silent;
    headMesh.morphTargetInfluences[0] = viseme.jawOpen || 0;
}

export function getHeadMesh() {
    return headMesh;
}

export function renderFrame() {
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}
