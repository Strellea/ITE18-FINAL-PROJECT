import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Simple Wake Shader
const WakeShader = {
    uniforms: {
        time: { value: 0 },
        opacity: { value: 0.9 }
    },
    vertexShader: `
        varying vec2 vUV;
        uniform float time;

        void main() {
            vUV = uv;
            vec3 pos = position;
            
            // Simple wave motion
            pos.y += sin(pos.x * 10.0 + time * 3.0) * 0.03;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUV;
        uniform float time;
        uniform float opacity;

        void main() {
            // Scrolling foam texture
            vec2 uv = vec2(vUV.x, vUV.y - time * 0.15);
            
            // Distance from center and V-angle calculation
            float distFromCenter = abs(vUV.x - 0.5) * 2.0;
            float spreadAngle = vUV.y * 1.5;
            
            // Create sharp V-lines on both sides
            float vLineLeft = 1.0 - smoothstep(0.0, 0.15, abs(distFromCenter - spreadAngle));
            float vLineRight = vLineLeft; // Same for both sides
            
            // Thin center wake trail (directly behind boat)
            float centerWake = exp(-distFromCenter * 12.0) * (1.0 - vUV.y * 0.5);
            
            // Animated foam pattern
            float foam = sin(uv.x * 22.0 + time * 2.5) * sin(uv.y * 14.0 - time);
            foam = smoothstep(0.3, 0.7, foam);
            
            // Turbulence on V-lines
            float turbulence = sin(uv.y * 30.0 + time * 3.0) * 0.3 + 0.7;
            
            // Combine: V-lines + subtle center + foam
            float vPattern = (vLineLeft + vLineRight) * turbulence;
            float pattern = vPattern * 0.8 + centerWake * 0.4;
            pattern *= (0.7 + foam * 0.3);
            
            // Smooth fade from front to back
            float fadeBack = smoothstep(0.95, 0.15, vUV.y);
            float fadeFront = smoothstep(0.0, 0.08, vUV.y);
            
            // Extra fade for center wake only in the back
            float centerFade = 1.0 - smoothstep(0.3, 0.6, vUV.y);
            pattern = vPattern * fadeBack + centerWake * centerFade * 0.6;
            
            float alpha = pattern * fadeFront * opacity;
            
            gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
    `
};

const RippleShader = {
    uniforms: {
        time: { value: 0 },
        opacity: { value: 0.7 }
    },
    vertexShader: `
        varying vec2 vUv;
        uniform float time;
        void main() {
            vUv = uv;
            vec3 pos = position;
            
            // More pronounced wave distortion
            float wave = sin(length(vUv - 0.5) * 12.0 - time * 2.5) * 0.04;
            pos.z += wave;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float opacity;
        varying vec2 vUv;

        void main() {
            vec2 center = vec2(0.5, 0.5);
            float dist = length(vUv - center) * 2.0;
            
            // Expanding ripple rings that fade over time
            float ripple1 = sin((dist - time * 0.8) * 12.0) * exp(-dist * 1.5);
            float ripple2 = sin((dist - time * 0.6) * 10.0) * exp(-dist * 1.2);
            
            // Turbulent foam pattern
            float foam = sin(vUv.x * 20.0 + time * 2.0) * sin(vUv.y * 20.0 - time * 1.5);
            foam = smoothstep(0.3, 0.7, foam) * 0.3;
            
            // V-shaped wake spreading outward
            vec2 fromCenter = vUv - center;
            float angle = abs(atan(fromCenter.x, fromCenter.y));
            float vWake = smoothstep(0.3, 0.8, angle / 1.57) * (1.0 - dist * 0.5);
            
            // Combine patterns
            float pattern = (ripple1 * 0.6 + ripple2 * 0.4) * (0.7 + vWake * 0.3);
            pattern += foam * (1.0 - dist * 0.8);
            
            // Fade from center and edges
            float centerFade = smoothstep(0.0, 0.2, dist);
            float edgeFade = smoothstep(1.2, 0.5, dist);
            
            pattern *= centerFade * edgeFade;
            
            // Better contrast
            pattern = smoothstep(0.1, 0.9, pattern);
            
            float alpha = pattern * opacity;
            
            // White foam with slight blue tint
            vec3 color = vec3(0.95, 0.97, 1.0);
            
            gl_FragColor = vec4(color, alpha);
        }
    `
};

let rippleMat;

class SplashParticles {
    constructor(scene, count = 20, size = 0.1) {
        this.scene = scene;
        this.count = count;

        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3); 
        const velocities = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;

            velocities[i * 3] = (Math.random() - 0.5) * 0.6;  
            velocities[i * 3 + 1] = Math.random() * 0.8 + 0.3; 
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        }

        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        this.velocities = velocities;

        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: size,
            transparent: true,
            opacity: 0.9
        });

        this.points = new THREE.Points(geo, mat);
        this.life = 1.0;
        this.points.visible = false;

        scene.add(this.points);
    }

    trigger(position) {
        this.points.position.copy(position);
        this.points.visible = true;
        this.life = 1.0;

        const posAttr = this.points.geometry.attributes.position;
        
        for (let i = 0; i < this.count; i++) {
            posAttr.array[i * 3] = 0;
            posAttr.array[i * 3 + 1] = 0;
            posAttr.array[i * 3 + 2] = 0;

            this.velocities[i * 3] = (Math.random() - 0.5) * 0.8;
            this.velocities[i * 3 + 1] = Math.random() * 1.0 + 0.5;
            this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
        }
        posAttr.needsUpdate = true;
    }

    update(delta) {
        if (!this.points.visible) return;

        this.life -= delta * 1.5;
        if (this.life <= 0) {
            this.points.visible = false;
            return;
        }

        const posAttr = this.points.geometry.attributes.position;
        for (let i = 0; i < this.count; i++) {
            this.velocities[i * 3 + 1] -= 0.02;

            posAttr.array[i * 3] += this.velocities[i * 3];
            posAttr.array[i * 3 + 1] += this.velocities[i * 3 + 1];
            posAttr.array[i * 3 + 2] += this.velocities[i * 3 + 2];
        }

        posAttr.needsUpdate = true;
    }
}

class Seagull {
    constructor(scene) {
        const geo = new THREE.ConeGeometry(0.1, 0.3, 4);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        this.mesh = new THREE.Mesh(geo, mat);
        
        const wingGeo = new THREE.PlaneGeometry(0.4, 0.15);
        const wingMat = new THREE.MeshStandardMaterial({ 
            color: 0xeeeeee, 
            side: THREE.DoubleSide 
        });
        
        this.leftWing = new THREE.Mesh(wingGeo, wingMat);
        this.rightWing = new THREE.Mesh(wingGeo, wingMat);
        
        this.leftWing.position.set(-0.2, 0, 0);
        this.rightWing.position.set(0.2, 0, 0);
        
        this.mesh.add(this.leftWing, this.rightWing);
        
        this.mesh.rotation.x = Math.PI / 2;
        this.reset();
        
        scene.add(this.mesh);
        this.wingTime = Math.random() * Math.PI * 2;
    }

    reset() {
        this.mesh.position.set(
            (Math.random() - 0.5) * 20,
            3 + Math.random() * 4,
            -60 - Math.random() * 40
        );
        this.speed = 0.2 + Math.random() * 0.15;
        this.sideSpeed = (Math.random() - 0.5) * 0.05;
    }

    update(delta, boatZ) {
        this.mesh.position.z += this.speed;
        this.mesh.position.x += this.sideSpeed;

        this.wingTime += delta * 8;
        const flapAngle = Math.sin(this.wingTime) * 0.6;
        this.leftWing.rotation.y = -flapAngle;
        this.rightWing.rotation.y = flapAngle;

        if (this.mesh.position.z > boatZ + 20) {
            this.reset();
        }
    }
}

class CloudSystem {
    constructor(scene) {
        this.clouds = [];
        this.scene = scene;

        for (let i = 0; i < 12; i++) {
            this.spawnCloud();
        }
    }

    spawnCloud() {
        const cloud = new THREE.Group();
        const puffCount = 3 + Math.floor(Math.random() * 3);

        for (let i = 0; i < puffCount; i++) {
            const geo = new THREE.SphereGeometry(
                1 + Math.random() * 0.8, 
                8, 8
            );
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0xffffff, 
                roughness: 1,
                metalness: 0
            });
            const puff = new THREE.Mesh(geo, mat);
            puff.position.set(
                (Math.random() - 0.5) * 2,
                Math.random() * 0.5,
                (Math.random() - 0.5) * 2
            );
            cloud.add(puff);
        }

        cloud.position.set(
            (Math.random() - 0.5) * 80,
            15 + Math.random() * 10,
            (Math.random() - 0.5) * 200 - 50
        );

        cloud.scale.set(1.5, 1, 1.5);
        
        this.scene.add(cloud);
        this.clouds.push({
            mesh: cloud,
            speed: 0.02 + Math.random() * 0.03
        });
    }

    update(boatZ) {
        this.clouds.forEach((cloud, idx) => {
            cloud.mesh.position.z += cloud.speed;

            if (cloud.mesh.position.z > boatZ + 50) {
                this.scene.remove(cloud.mesh);
                this.clouds.splice(idx, 1);
                this.spawnCloud();
            }
        });
    }
}

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87ceeb, 10, 120);

const skyColor = new THREE.Color(0x87ceeb);
scene.background = skyColor;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.8);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff5e6, 1.2);
sun.position.set(-20, 30, -20);
scene.add(sun);

const ambient = new THREE.AmbientLight(0x4488ff, 0.3);
scene.add(ambient);

const oceanGeo = new THREE.PlaneGeometry(120, 220, 80, 120);
const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x1e90ff, 
    side: THREE.DoubleSide, 
    flatShading: true,
    roughness: 0.7,
    metalness: 0.2
});
const ocean = new THREE.Mesh(oceanGeo, oceanMat);
ocean.rotation.x = -Math.PI/2;
scene.add(ocean);

const cloudSystem = new CloudSystem(scene);
const seagulls = [];
for (let i = 0; i < 4; i++) {
    seagulls.push(new Seagull(scene));
}

const listener = new THREE.AudioListener();
camera.add(listener);

const audioLoader = new THREE.AudioLoader();

const dodgeSound = new THREE.Audio(listener);
const gameOverSound = new THREE.Audio(listener);
const bgm = new THREE.Audio(listener);

audioLoader.load('/sounds/dodge.wav', buffer => {
    dodgeSound.setBuffer(buffer);
    dodgeSound.setVolume(1.0);
});

audioLoader.load('/sounds/gameover.wav', buffer => {
    gameOverSound.setBuffer(buffer);
    gameOverSound.setVolume(1.0);
});

audioLoader.load('/sounds/music.mp3', buffer => {
    bgm.setBuffer(buffer);
    bgm.setLoop(true);
    bgm.setVolume(0.4);
});

const muteBtn = document.createElement('button');
muteBtn.innerText = 'Music: ON';
muteBtn.style.display = 'none';
document.body.appendChild(muteBtn);

let isMusicPlaying = false;

function toggleBGM() {
    if (bgm.isPlaying) {
        bgm.pause();
        isMusicPlaying = false;
    } else if (bgm.buffer) {
        bgm.play();
        isMusicPlaying = true;
    }
}

window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') {
        toggleBGM();
    }
});

let boat;
const loader = new GLTFLoader();

loader.load(
    '/models/fishing_boat.glb', 
    function(gltf) {
        boat = gltf.scene;
        boat.position.set(0, 1.2, 0);
        boat.scale.set(4, 4, 4); 
        boat.rotation.y = Math.PI / 2;
        
        scene.add(boat);

        boat.userData.bowSplash = new SplashParticles(scene, 20, 0.12);
        boat.userData.hitSplash = new SplashParticles(scene, 40, 0.15);

        const wakeMat = new THREE.ShaderMaterial({
            uniforms: WakeShader.uniforms,
            vertexShader: WakeShader.vertexShader,
            fragmentShader: WakeShader.fragmentShader,
            transparent: true,
            depthWrite: false
        });

        // V-shaped wake trail
        const centerWake = new THREE.Mesh(
            new THREE.PlaneGeometry(2.5, 8, 32, 32), 
            wakeMat
        );
        centerWake.rotation.x = -Math.PI/2;
        centerWake.rotation.z = Math.PI/2;
        centerWake.position.set(-3.5, -0.15, 0);
        boat.add(centerWake);

        rippleMat = new THREE.ShaderMaterial({
            uniforms: RippleShader.uniforms,
            vertexShader: RippleShader.vertexShader,
            fragmentShader: RippleShader.fragmentShader,
            transparent: true,
            depthWrite: false
        });

        const ripple = new THREE.Mesh(
            new THREE.PlaneGeometry(4, 8, 32, 32),
            rippleMat
        );

        ripple.rotation.x = -Math.PI/2;
        ripple.position.set(-4.0, -0.18, 0);
        boat.add(ripple);
    },
    function(xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    function(error) {
        console.error('Error loading GLTF:', error);
        createFallbackBoat();
    }
);

function createFallbackBoat() {
    const boatGeo = new THREE.BoxGeometry(1, 0.5, 2);
    const boatMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    boat = new THREE.Mesh(boatGeo, boatMat);
    boat.position.set(0, 0.25, 0);
    scene.add(boat);

    boat.userData.bowSplash = new SplashParticles(scene, 20, 0.8);
    boat.userData.hitSplash = new SplashParticles(scene, 80, 0.3);
}

const obstacles = [];
const scoreEl = document.getElementById('score');
const gameOverEl = document.getElementById('gameover');
let gameOverPlayed = false;
let score = 0;
let gameOver = false;
let isPaused = false;

let moveLeft = false;
let moveRight = false;
const dodgeSpeed = 0.2;

window.addEventListener('keydown', e => {
    if (gameOver || !boat) return;

    if (!bgm.isPlaying && !isMusicPlaying && bgm.buffer) {
        bgm.play();
        isMusicPlaying = true;
        muteBtn.innerText = 'Music: ON';
        muteBtn.style.background = 'rgba(100, 255, 100, 0.7)';
    }

    if (e.code === 'KeyA') {
        moveLeft = true;
        if (dodgeSound.buffer) dodgeSound.play();
    }
    if (e.code === 'KeyD') {
        moveRight = true;
        if (dodgeSound.buffer) dodgeSound.play();
    }
});

window.addEventListener('keyup', e => {
    if (e.code === 'KeyA') moveLeft = false;
    if (e.code === 'KeyD') moveRight = false;
});

let obstacleSpeed = 0.3;
const speedIncrement = 0.00030;

const textureLoader = new THREE.TextureLoader();
let woodTexture = null;
let rockTexture = null;

function spawnObstacle() {
    const rockGroup = new THREE.Group();
    
    const mainGeo = new THREE.DodecahedronGeometry(0.6, 0);
    const rockMat = new THREE.MeshStandardMaterial({
        map: rockTexture || null,
        color: rockTexture ? 0xffffff : 0x3a3a3a,
        roughness: 0.95,
        metalness: 0.1,
        flatShading: true
    });
    const mainRock = new THREE.Mesh(mainGeo, rockMat);
    mainRock.position.y = 0.3;
    
    const detail1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), rockMat);
    detail1.position.set(0.4, 0.2, 0.2);
    
    const detail2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), rockMat);
    detail2.position.set(-0.3, 0.15, -0.2);
    
    rockGroup.add(mainRock, detail1, detail2);
    
    rockGroup.rotation.x = Math.random() * Math.PI;
    rockGroup.rotation.y = Math.random() * Math.PI;
    rockGroup.rotation.z = Math.random() * Math.PI;
    
    rockGroup.position.x = (Math.random() - 0.5) * 6;
    rockGroup.position.y = 0.2; // Floating on water surface
    rockGroup.position.z = boat ? boat.position.z - 40 : -40;
    
    scene.add(rockGroup);
    obstacles.push(rockGroup);
}

function spawnLog() {
    const logGroup = new THREE.Group();

    const logGeo = new THREE.CylinderGeometry(0.3, 0.35, 3, 20);
    const logMat = new THREE.MeshStandardMaterial({
        map: woodTexture || null,
        color: woodTexture ? 0xffffff : 0x8B4513,
        roughness: 0.85,
        metalness: 0.0
    });
    const log = new THREE.Mesh(logGeo, logMat);

    const endCapGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 20);
    const endCapMat = new THREE.MeshStandardMaterial({
        map: woodTexture || null,
        color: woodTexture ? 0xffffff : 0xD2691E,
        roughness: 0.9
    });

    const endCap1 = new THREE.Mesh(endCapGeo, endCapMat);
    endCap1.position.y = 1.5;
    const endCap2 = new THREE.Mesh(endCapGeo, endCapMat);
    endCap2.position.y = -1.5;

    const branchGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.4, 8);
    const branch1 = new THREE.Mesh(branchGeo, logMat);
    branch1.position.set(0.25, 0.5, 0);
    branch1.rotation.z = Math.PI / 3;
    
    const branch2 = new THREE.Mesh(branchGeo, logMat);
    branch2.position.set(-0.25, -0.3, 0);
    branch2.rotation.z = -Math.PI / 4;
    
    logGroup.add(log, endCap1, endCap2, branch1, branch2);
    
    logGroup.rotation.z = Math.PI / 2;
    logGroup.rotation.y = Math.random() * Math.PI * 2;
    
    logGroup.position.x = (Math.random() - 0.5) * 6;
    logGroup.position.y = 0.2; // Floating on water surface
    logGroup.position.z = boat ? boat.position.z - 40 : -40;

    scene.add(logGroup);
    obstacles.push(logGroup);
}

textureLoader.load(
    '/models/textures/wood.jpg',
    (texture) => {
        woodTexture = texture;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    },
    undefined,
    (error) => {
        console.error('Error loading wood texture:', error);
    }
);

textureLoader.load(
    '/models/textures/rock.jpg',
    (texture) => {
        rockTexture = texture;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    },
    undefined,
    (error) => {
        console.log('Rock texture not found, using fallback color');
    }
);

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (boat && WakeShader.uniforms) {
        WakeShader.uniforms.time.value += delta;
    }
    if (rippleMat) rippleMat.uniforms.time.value += delta * 0.8;

    const pos = ocean.geometry.attributes.position;
    const time = clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        // Waves moving in the direction of travel (along Y axis only)
        const z = 0.4 * Math.sin(y * 0.3 + time * 1.5) +
                  0.3 * Math.cos(y * 0.5 + time * 2.0) +
                  0.2 * Math.sin(y * 0.8 + time * 2.5);
        pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    ocean.geometry.computeVertexNormals();

    if (boat) {
        cloudSystem.update(boat.position.z);
        seagulls.forEach(seagull => seagull.update(delta, boat.position.z));
    }

    if (boat) {
        // Only update particle physics, no continuous bow splash
        if (boat.userData.bowSplash) boat.userData.bowSplash.update(delta);
        if (boat.userData.hitSplash) boat.userData.hitSplash.update(delta);
    }

    // Make obstacles float on water with bobbing motion
    obstacles.forEach((obs, idx) => {
        const baseY = 0.2;
        const bobAmount = 0.08;
        const bobSpeed = 1.5;
        obs.position.y = baseY + Math.sin(time * bobSpeed + idx) * bobAmount;
        obs.rotation.y += 0.005; // Gentle rotation
    });

    if (!gameOver && !isPaused) {
        if (boat) {
            if (moveLeft) boat.position.x -= dodgeSpeed;
            if (moveRight) boat.position.x += dodgeSpeed;
            boat.position.x = THREE.MathUtils.clamp(boat.position.x, -3, 3);

            obstacles.forEach((obs, idx) => {
                obs.position.z += obstacleSpeed;

                const dx = Math.abs(boat.position.x - obs.position.x);
                const dz = Math.abs(boat.position.z - obs.position.z);
                const dy = Math.abs(boat.position.y - obs.position.y);

                if (dx < 1 && dz < 1 && dy < 1.5) {
                    if (!gameOverPlayed) {
                        if (gameOverSound.buffer) gameOverSound.play();
                        gameOverPlayed = true;
                    }

                    gameOver = true;
                    gameOverEl.style.display = "block";

                    boat.userData.hitSplash.trigger(
                        new THREE.Vector3(boat.position.x, 0.0, boat.position.z - 3.0)
                    );
                }

                if (obs.position.z > boat.position.z + 5) {
                    scene.remove(obs);
                    obstacles.splice(idx, 1);
                    score++;
                    scoreEl.textContent = `Score: ${score}`;
                }
            });

            obstacleSpeed += speedIncrement;

            if (Math.random() < 0.02) {
                Math.random() < 0.5 ? spawnObstacle() : spawnLog();
            }
        }

        const cameraOffsetZ = 14;
        const cameraOffsetY = 8;
        const smoothFactor = 0.1;

        if (boat) {
            camera.position.x += (boat.position.x - camera.position.x) * smoothFactor;
            camera.position.y += (boat.position.y + cameraOffsetY - camera.position.y) * smoothFactor;
            camera.position.z += (boat.position.z + cameraOffsetZ - camera.position.z) * smoothFactor;
            camera.lookAt(boat.position);
        }
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const pauseBtn = document.getElementById('pauseBtn');
const pauseMenu = document.getElementById('pauseMenu');
const resumeBtn = document.getElementById('resumeBtn');

function togglePause() {
    if (gameOver) return;
    
    isPaused = !isPaused;
    pauseMenu.style.display = isPaused ? 'block' : 'none';
    pauseBtn.style.display = isPaused ? 'none' : 'block';
    
    if (isPaused && bgm.isPlaying) {    
        bgm.pause();
    } else if (!isPaused && isMusicPlaying && bgm.buffer) {
        bgm.play();
    }
}

pauseBtn.addEventListener('click', togglePause);
resumeBtn.addEventListener('click', togglePause);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        togglePause();
    }
});