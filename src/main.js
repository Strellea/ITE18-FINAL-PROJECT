import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- Enhanced Wake Shader ---
const WakeShader = {
    uniforms: {
        time: { value: 0 },
        opacity: { value: 0.8 },
        speed: { value: 1.2 }
    },
    vertexShader: `
        varying vec2 vUV;
        varying vec3 vPosition;
        uniform float time;
        uniform float speed;

        void main() {
            vUV = uv;
            vPosition = position;
            
            // Multi-layered ripple effect
            vec3 pos = position;
            

            float wave1 = sin(pos.x * 15.0 + time * speed * 2.0) * 0.04;
            float wave2 = sin(pos.x * 8.0 - time * speed * 1.5) * 0.025;
            float centerDist = abs(pos.x);
            float turbulence = sin(pos.x * 20.0 + time * speed * 3.0) * 0.02 * (1.0 - centerDist);
            float ripple = sin(pos.y * 10.0 - time * speed * 2.5) * 0.015;
            
            pos.y += wave1 + wave2 + turbulence + ripple;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUV;
        varying vec3 vPosition;
        uniform float time;
        uniform float opacity;
        uniform float speed;

        void main() {
            float scroll = time * 0.2 * speed;
            vec2 uv = vec2(vUV.x, vUV.y - scroll);

            // Animated foam pattern
            float foam1 = sin(uv.x * 25.0 + time * speed) * 0.5 + 0.5;
            float foam2 = sin(uv.x * 18.0 - time * speed * 0.7 + uv.y * 10.0) * 0.5 + 0.5;
            float foamPattern = foam1 * foam2;

            float rings = sin((uv.y + time * 0.3 * speed) * 15.0) * 0.5 + 0.5;
            rings = pow(rings, 3.0);
            
            float fadeBack = smoothstep(0.5, 0.0, vUV.y);
            float sideFade = 1.0 - pow(abs(vUV.x - 0.5) * 2.0, 1.5);
            
            // Combine patterns
            float pattern = mix(foamPattern, rings, 0.4);
            float alpha = fadeBack * sideFade * opacity * (0.6 + pattern * 0.4);
            vec3 color = mix(vec3(1.0, 1.0, 1.0), vec3(0.9, 0.95, 1.0), 0.3);
            gl_FragColor = vec4(color, alpha);
        }
    `
};

// RIPPLE SHADER (expanding circular ripples in water)
const RippleShader = {
    uniforms: {
        time: { value: 0 },
        opacity: { value: 0.5 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float opacity;
        varying vec2 vUv;

        void main() {
            float dist = length(vUv - 0.5);

            float ring = sin((dist - time * 0.8) * 25.0);
            ring = smoothstep(0.1, 0.0, dist) * ring;

            float alpha = ring * opacity;

            gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
    `
};

let rippleMat;
let splashTimer = 0; 

// SPLASH PARTICLES 
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

            // random spray velocity
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
        
        // 2. Reset and re-randomize velocities and local positions for a new spray
        for (let i = 0; i < this.count; i++) {
            // Reset local position to zero (relative to this.points.position)
            posAttr.array[i * 3] = 0;
            posAttr.array[i * 3 + 1] = 0;
            posAttr.array[i * 3 + 2] = 0;

            // Re-randomize velocity for a fresh upward spray
            this.velocities[i * 3] = (Math.random() - 0.5) * 0.8;  // Wider spread
            this.velocities[i * 3 + 1] = Math.random() * 1.0 + 0.5; // Stronger upward thrust
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
            this.velocities[i * 3 + 1] -= 0.02; // gravity

            posAttr.array[i * 3] += this.velocities[i * 3];
            posAttr.array[i * 3 + 1] += this.velocities[i * 3 + 1];
            posAttr.array[i * 3 + 2] += this.velocities[i * 3 + 2];
        }

        posAttr.needsUpdate = true;
    }
}


const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0,5,10);
camera.lookAt(0,0,0);

// Renderer
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lights
const hemi = new THREE.HemisphereLight(0xffffff,0x444444,1);
hemi.position.set(0,20,0);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff,0.8);
dir.position.set(-5,10,-5);
scene.add(dir);

// Ocean
const oceanGeo = new THREE.PlaneGeometry(100,200,50,100);
const oceanMat = new THREE.MeshStandardMaterial({color:0x1e90ff, side:THREE.DoubleSide, flatShading:true});
const ocean = new THREE.Mesh(oceanGeo, oceanMat);
ocean.rotation.x = -Math.PI/2;
scene.add(ocean);

// --- SOUND EFFECTS & MUSIC ---
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
    bgm.setLoop(true);   // Loop the music
    bgm.setVolume(0.4);  // Lower volume so it's not too loud
});

// --- BG MUSIC ---
const muteBtn = document.createElement('button');
muteBtn.innerText = 'Music: ON'; // Default to OFF until interaction starts it
muteBtn.style.display = 'none';
document.body.appendChild(muteBtn);

let isMusicPlaying = false;

// Function to toggle music (Mute/Unmute)
function toggleBGM() {
    if (bgm.isPlaying) {
        bgm.pause();
        isMusicPlaying = false; // Player chose to turn it off
    } else if (bgm.buffer) {
        bgm.play();
        isMusicPlaying = true; // Player chose to turn it on
    }
}

// Add Mute/Unmute functionality for testing (e.g., press 'M')
window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') {
        toggleBGM();
    }
});


// Load GLTF Boat
let boat;
const loader = new GLTFLoader();

loader.load(
    '/models/fishing_boat.glb', 
    function(gltf) {
        boat = gltf.scene;
        boat.position.set(0, 1.2, 0);
        boat.scale.set(4, 4, 4); 
        // Optional: Rotate if the boat is facing wrong direction
        boat.rotation.y = Math.PI / 2;
        
        scene.add(boat);

        // Continuous bow splash
        let bowSplash = new SplashParticles(scene, 20, 0.12);

        // Collision splash
        let hitSplash = new SplashParticles(scene, 40, 0.15);

        // store for animation loop
        boat.userData.bowSplash = bowSplash;
        boat.userData.hitSplash = hitSplash;


        // --- WAKE GEOMETRY --- //
        const centerGeo = new THREE.PlaneGeometry(0.6, 6, 32, 32);  
        const sideGeo = new THREE.PlaneGeometry(0.45, 4, 32, 32); 

        // Material
        const wakeMat = new THREE.ShaderMaterial({
            uniforms: WakeShader.uniforms,
            vertexShader: WakeShader.vertexShader,
            fragmentShader: WakeShader.fragmentShader,
            transparent: true,
            depthWrite: false
        });

        // --- CENTER WAKE --- //
        const centerWake = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 6, 32, 32), wakeMat);
        centerWake.rotation.x = -Math.PI/2;
        centerWake.rotation.z = Math.PI/2;
        centerWake.position.set(-2.6, -0.15, 0);
        boat.add(centerWake);

        const leftWake = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 4, 32, 32), wakeMat);
        leftWake.rotation.x = -Math.PI/2;
        leftWake.rotation.z = Math.PI/2 + 0.35;
        leftWake.position.set(-2.0, -0.15, 0.45);
        boat.add(leftWake);

        const rightWake = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 4, 32, 32), wakeMat);
        rightWake.rotation.x = -Math.PI/2;
        rightWake.rotation.z = Math.PI/2 - 0.35;
        rightWake.position.set(-2.0, -0.15, -0.45);
        boat.add(rightWake);

        // --- CIRCULAR RIPPLE BEHIND THE BOAT --- //
        rippleMat = new THREE.ShaderMaterial({
        uniforms: RippleShader.uniforms,
        vertexShader: RippleShader.vertexShader,
        fragmentShader: RippleShader.fragmentShader,
        transparent: true,
        depthWrite: false
    });

    const ripple = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 7, 32, 32),
        rippleMat
    );

    ripple.rotation.x = -Math.PI/2;
    ripple.position.set(-3.5, -0.19, 0);
    boat.add(ripple);
    },
    
    function(xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    function(error) {
        console.error('Error loading GLTF:', error);
        // Fallback to basic geometry if model fails to load
        createFallbackBoat();
    }

);

// Fallback boat (your original code)
function createFallbackBoat() {
    const boatGeo = new THREE.BoxGeometry(1,0.5,2);
    const boatMat = new THREE.MeshStandardMaterial({color:0xff0000});
    boat = new THREE.Mesh(boatGeo, boatMat);
    boat.position.set(0,0.25,0);
    scene.add(boat);

    // Add particle systems to fallback boat too
    boat.userData.bowSplash = new SplashParticles(scene, 20, 0.8);
    boat.userData.hitSplash = new SplashParticles(scene, 80, 0.3);
}



// Obstacles
const obstacles = [];
const scoreEl = document.getElementById('score');
const gameOverEl = document.getElementById('gameover');
let gameOverPlayed = false;
let score = 0;
let gameOver = false;
let isPaused = false;

let moveLeft = false;
let moveRight = false;
const dodgeSpeed = 0.2; // how fast the boat moves sideways

// DODGE SOUND 
window.addEventListener('keydown', e => {
    if (gameOver || !boat) return;

    // browser policy: Start music on first interaction if it hasn't started
    if (!bgm.isPlaying && !isMusicPlaying && bgm.buffer) {
        bgm.play();
        isMusicPlaying = true;
        muteBtn.innerText = 'Music: ON';
        muteBtn.style.background = 'rgba(100, 255, 100, 0.7)';
    }

    if (e.code === 'KeyA') {
        moveLeft = true;
        if(dodgeSound.buffer) dodgeSound.play();

        // Optional: Trigger splash
        if (boat.userData.hitSplash) {
            boat.userData.hitSplash.trigger(
                new THREE.Vector3(boat.position.x - 0.5, 0.0, boat.position.z- 1.0)
            );
        }
    }
    if (e.code === 'KeyD') {
        moveRight = true;
        if(dodgeSound.buffer) dodgeSound.play();

        // Optional: Trigger splash
        if (boat.userData.hitSplash) {
            boat.userData.hitSplash.trigger(
                new THREE.Vector3(boat.position.x - 0.5, 0.0, boat.position.z - 1.0)
            );
        }
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

// Spawn obstacle
function spawnObstacle(){
    // Create more irregular rock shape using multiple geometries
    const rockGroup = new THREE.Group();
    
    // Main rock body - use DodecahedronGeometry for more natural look
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
    
    // Add smaller rocks for detail
    const detail1 = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.3, 0),
        rockMat
    );
    detail1.position.set(0.4, 0.2, 0.2);
    
    const detail2 = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.25, 0),
        rockMat
    );
    detail2.position.set(-0.3, 0.15, -0.2);
    
    rockGroup.add(mainRock, detail1, detail2);
    
    // Random rotation for variety
    rockGroup.rotation.x = Math.random() * Math.PI;
    rockGroup.rotation.y = Math.random() * Math.PI;
    rockGroup.rotation.z = Math.random() * Math.PI;
    
    rockGroup.position.x = (Math.random()-0.5)*6;
    rockGroup.position.y = 0.5;
    rockGroup.position.z = boat ? boat.position.z - 40 : -40;
    
    scene.add(rockGroup);
    obstacles.push(rockGroup);
}

function spawnLog(){
    const logGroup = new THREE.Group();

    const logGeo = new THREE.CylinderGeometry(0.3, 0.35, 3, 20); // radiusTop, radiusBottom, height, segments
    const logMat = new THREE.MeshStandardMaterial({
        map: woodTexture || null,
        color: woodTexture ? 0xffffff : 0x8B4513,
        roughness: 0.85,  
        metalness: 0.0 
    });
    const log = new THREE.Mesh(logGeo, logMat);

    // Add end caps with different color for tree rings
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

    // Add small branch stubs for realism
    const branchGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.4, 8);
    const branch1 = new THREE.Mesh(branchGeo, logMat);
    branch1.position.set(0.25, 0.5, 0);
    branch1.rotation.z = Math.PI / 3;
    
    const branch2 = new THREE.Mesh(branchGeo, logMat);
    branch2.position.set(-0.25, -0.3, 0);
    branch2.rotation.z = -Math.PI / 4;
    
    logGroup.add(log, endCap1, endCap2, branch1, branch2);
    
    // Rotate so it lies flat and add some variety
    logGroup.rotation.z = Math.PI / 2;
    logGroup.rotation.y = Math.random() * Math.PI * 2;
    
    logGroup.position.x = (Math.random() - 0.5) * 6;
    logGroup.position.y = 0.25;
    logGroup.position.z = boat ? boat.position.z - 40 : -40;

    scene.add(logGroup);
    obstacles.push(logGroup);
}

// Load wood texture with error handling
textureLoader.load(
    '/models/textures/wood.jpg',
    (texture) => {
        woodTexture = texture;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        console.log('Wood texture loaded successfully');
    },
    undefined,
    (error) => {
        console.error('Error loading wood texture:', error);
    }
);

// Load rusty metal texture
textureLoader.load(
    '/models/textures/rock.jpg',
    (texture) => {
        rockTexture = texture;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        console.log('Rusty texture loaded successfully');
    },
    undefined,
    (error) => {
        console.log('Rusty texture not found, using fallback color');
    }
);


// Clock
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();  

    // Shaders & Water
    if (boat && WakeShader.uniforms) {
        WakeShader.uniforms.time.value += delta;
    }
    if (rippleMat) rippleMat.uniforms.time.value += delta * 0.8;

    const pos = ocean.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = 0.3 * Math.sin(x * 0.5 + clock.elapsedTime * 2) +
                  0.3 * Math.cos(y * 0.5 + clock.elapsedTime * 2);
        pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    ocean.geometry.computeVertexNormals();

    // Particles
    if (boat) {
        // Only trigger NEW bow splashes if the game is running
        if (!gameOver) {
            splashTimer += delta;
            if (splashTimer > 0.12) {
                boat.userData.bowSplash.trigger(
                    new THREE.Vector3(
                        boat.position.x,
                        0.0,
                        boat.position.z + 1.8
                    )
                );
                splashTimer = 0;
            }
        }

        // ALWAYS update physics for particles (so they fall/fade even after gameover)
        if (boat.userData.bowSplash) boat.userData.bowSplash.update(delta);
        if (boat.userData.hitSplash) boat.userData.hitSplash.update(delta);
    }

        // GAME LOGIC (Stops on Game Over)
        if (!gameOver && !isPaused) {
        
        if (boat) {
            if (moveLeft) boat.position.x -= dodgeSpeed;
            if (moveRight) boat.position.x += dodgeSpeed;
            boat.position.x = THREE.MathUtils.clamp(boat.position.x, -3, 3);

            obstacles.forEach((obs, idx) => {
                obs.position.z += obstacleSpeed;

                // Collision Logic
                const dx = Math.abs(boat.position.x - obs.position.x);
                const dz = Math.abs(boat.position.z - obs.position.z);
                const dy = Math.abs(boat.position.y - obs.position.y);

                if (dx < 1 && dz < 1 && dy < 1) {

                    if (!gameOverPlayed) {
                        if (gameOverSound.buffer) gameOverSound.play();
                        gameOverPlayed = true;
                    }

                    gameOver = true;
                    gameOverEl.style.display = "block";

                    // Trigger the HIT splash exactly at the impact point
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

        // Camera follow
        const cameraOffsetZ = 10;
        const cameraOffsetY = 5;
        const smoothFactor = 0.1;

        if (boat) {
            camera.position.x += (boat.position.x - camera.position.x) * smoothFactor;
            camera.position.y += (boat.position.y + cameraOffsetY - camera.position.y) * smoothFactor;
            camera.position.z += (boat.position.z + cameraOffsetZ - camera.position.z) * smoothFactor;
            camera.lookAt(boat.position);
        }
    }

    renderer.render(scene, camera);  // always render
}

animate();

// Resize
window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Pause functionality
const pauseBtn = document.getElementById('pauseBtn');
const pauseMenu = document.getElementById('pauseMenu');
const resumeBtn = document.getElementById('resumeBtn');

function togglePause() {
  if (gameOver) return;
  
  isPaused = !isPaused;
  pauseMenu.style.display = isPaused ? 'block' : 'none';
  pauseBtn.style.display = isPaused ? 'none' : 'block';
  
  // Pause/resume background music
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