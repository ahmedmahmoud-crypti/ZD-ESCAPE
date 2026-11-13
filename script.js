safeIcons();

// --- BRANDING & GAME STATE ---
function safeIcons() {
    try { if (window.lucide && lucide.createIcons) lucide.createIcons(); } catch (e) { console.warn('Icons unavailable:', e); }
}
let devName = "ZD STUDIO";
let gameName = "ZD ESCAPE";
let currentRoomId = 1;
let inventory = [];
const TOTAL_ROOMS = 6;
const ROOM_IDS = Array.from({ length: TOTAL_ROOMS }, (_, i) => i + 1);
const ROOM_PUZZLE_IDS = { 1: 'room1_tv', 2: 'room2_terminal', 3: 'room3_book', 4: 'room4_terminal', 5: 'room5_arcade', 6: 'room6_vault' };
const ROOM_LED_COLORS = { 1: 0xd946ef, 2: 0x8b5cf6, 3: 0xff0055, 4: 0x22c55e, 5: 0xf59e0b, 6: 0x06b6d4 };
const INV_SLOTS = 5;
const ROOM1_COUNTS = { stands: 3, art: 4, books: 2 }; // single source of truth for the Room 1 counting puzzle
const HINT_COST = 50;          // points lost the first time you open a room's hint (set 0 for free hints)
const KING_TIME = 300;         // finish under this many seconds (5:00) to become KING OF THE GAME
let hintsUsedRooms = new Set();
function makeRoomUnlocked() {
    const o = {};
    ROOM_IDS.forEach(id => o[id] = (id === 1));
    return o;
}
let roomUnlocked = makeRoomUnlocked();
let currentPuzzle = null;
let secondsElapsed = 0;
let timerInterval = null;
let playerScore = 0; // starts at zero: +250 per solved room, -HINT_COST per hint used
const TIME_BONUS_MAX = 5000;      // speed bonus at 00:00, added at the end
const TIME_BONUS_PER_SEC = 4;     // bonus lost every second (hits 0 at ~20:50)

function timeBonus() {
    return Math.max(0, TIME_BONUS_MAX - secondsElapsed * TIME_BONUS_PER_SEC);
}
function updateScoreDisplay() {
    const el = document.getElementById('player-score');
    if (el) el.innerText = playerScore;
}
function getRank(sec) {
    if (sec < KING_TIME) return { key: 'king', label: 'RANK: KING', title: '\u{1F451} KING OF THE GAME \u{1F451}' };
    if (sec < 480) return { key: 'master', label: 'RANK: MASTER', title: '\u{1F947} MASTER ESCAPIST' };
    if (sec < 720) return { key: 'pro', label: 'RANK: PRO', title: '\u{1F948} PRO ESCAPIST' };
    return { key: 'rookie', label: 'RANK: ROOKIE', title: '\u{1F949} YOU ESCAPED!' };
}

// Puzzles & Interactive Objects Data (CHALLENGING LOGIC & OBSERVATIONAL PUZZLES)
const puzzleData = {
    room1_tv: {
        id: 'room1_tv',
        type: 'puzzle',
        title: 'Lounge Observation Lock',
        subtitle: 'ROOM 01 - NEON LOUNGE',
        icon: 'tv',
        text: 'Decode the 3-digit room lock by looking carefully around the lounge:<br><br><span class="text-cyan-400 font-mono-code block my-2 text-left text-sm bg-slate-950/70 p-3 rounded-xl border border-cyan-500/20">DIGIT 1: Neon letter stands on the TV console<br>DIGIT 2: Pieces of wall art (the big neon banner, posters and frames, on both walls)<br>DIGIT 3: Books stacked on the TV console</span><br>Enter the 3-digit code:',
        answer: String(ROOM1_COUNTS.stands) + ROOM1_COUNTS.art + ROOM1_COUNTS.books,
        rewardItem: { id: 'keycard_blue', name: 'Quantum Pass Keycard', icon: 'credit-card', color: 'text-cyan-400' },
        solved: false
    },

    room1_hint: {
        id: 'room1_hint',
        type: 'hint',
        title: 'Lounge Clue',
        subtitle: 'ROOM 01 - CRYPTIC HINT',
        icon: 'lightbulb',
        text: '<div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-center font-mono-code text-xs leading-relaxed">CLUE: Rotate the camera and count slowly. First the glowing letter stands sitting on the console, then every piece of art on BOTH walls (the big neon banner counts too), and finally the books lying on the console.</div>'
    },
    room2_terminal: {
        id: 'room2_terminal',
        type: 'puzzle',
        title: 'Prime & Binary Cipher Matrix',
        subtitle: 'ROOM 02 - MARBLE GAMING SUITE',
        icon: 'terminal',
        text: 'The ultrawide workstation requires a 4-character alphanumeric key:<br><br><span class="text-emerald-400 font-mono-code block my-2 text-center text-sm bg-slate-950/70 p-3 rounded-xl border border-emerald-500/20">[ 2 , 3 , 5 , 7 , 11 , ? ]  +  BINARY(1010)</span><br>Combine the next prime number in the sequence with the decimal value of binary 1010:',
        answer: '1310',
        rewardItem: { id: 'library_emblem', name: 'Ancient Memory Shard', icon: 'shield', color: 'text-purple-400' },
        solved: false
    },
    room2_hint: {
        id: 'room2_hint',
        type: 'hint',
        title: 'Shelf Figurine Note',
        subtitle: 'ROOM 02 - CRYPTIC HINT',
        icon: 'lightbulb',
        text: '<div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-center font-mono-code text-xs leading-relaxed">CLUE: Numbers divisible only by 1 and themselves form the left half. For the right half, convert base-2 powers (8 + 0 + 2 + 0) into base-10 and place them side by side.</div>'
    },
    room3_book: {
        id: 'room3_book',
        type: 'puzzle',
        title: 'Neon Cipher Console',
        subtitle: 'ROOM 03 - RGB COMMAND CENTER',
        icon: 'book-open',
        text: 'A hacker left an encrypted message on the command center screen. Each letter was shifted forward in the alphabet by the same number of steps (Caesar cipher).<br><br><span class="text-amber-300 font-bold block my-2 text-center text-2xl bg-slate-950/70 p-3 rounded-xl border border-amber-500/20 font-mono-code tracking-widest">JDPHU</span><span class="text-slate-400 text-xs block text-center">Example from the same cipher: A becomes D, so ZD becomes CG.</span><br>Decode the message and enter the original word:',
        answer: 'GAMER',
        rewardItem: { id: 'golden_key', name: 'Diamond Vault Key', icon: 'key', color: 'text-amber-400' },
        solved: false
    },
    room3_hint: {
        id: 'room3_hint',
        type: 'hint',
        title: 'Neon Light Strip Inspection',
        subtitle: 'ROOM 03 - CRYPTIC HINT',
        icon: 'lightbulb',
        text: '<div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-center font-mono-code text-xs leading-relaxed">CLUE: The shift is 3 steps. To decode, move every letter 3 steps BACK in the alphabet (D becomes A, E becomes B, and so on). The first letter J goes back to G.</div>'
    },
    room4_terminal: {
        id: 'room4_terminal',
        type: 'puzzle',
        title: 'Server Load Sequence',
        subtitle: 'ROOM 04 - SERVER ROOM',
        icon: 'server',
        text: 'The main server crashed. To reboot it, enter the next value in the load sequence shown on the monitor:<br><br><span class="text-emerald-400 font-mono-code block my-2 text-center text-lg bg-slate-950/70 p-3 rounded-xl border border-emerald-500/20">[ 2 , 6 , 12 , 20 , 30 , ? ]</span><br>Enter the missing number:',
        answer: '42',
        rewardItem: { id: 'data_drive', name: 'Encrypted Data Drive', icon: 'hard-drive', color: 'text-emerald-400' },
        solved: false
    },
    room4_hint: {
        id: 'room4_hint',
        type: 'hint',
        title: 'Server Room Hint',
        subtitle: 'ROOM 04 - HINT',
        icon: 'lightbulb',
        text: '<div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-center font-mono-code text-xs leading-relaxed">CLUE: Look at the GAP between each pair of numbers: 4, 6, 8, 10 ... The gap grows by 2 every time. What is the next gap, and what is 30 plus it?</div>'
    },
    room5_arcade: {
        id: 'room5_arcade',
        type: 'puzzle',
        title: 'Arcade Morse Signal',
        subtitle: 'ROOM 05 - RETRO ARCADE',
        icon: 'gamepad-2',
        text: 'The arcade cabinet is flashing a signal in Morse code. Dots are short flashes, dashes are long ones, and a space separates letters.<br><br><span class="text-amber-300 font-mono-code block my-2 text-center text-2xl bg-slate-950/70 p-3 rounded-xl border border-amber-500/20 tracking-widest">.-.. . ...- . .-..</span><span class="text-slate-400 font-mono-code text-xs block text-center">Morse key: L = .-.. &nbsp; E = . &nbsp; V = ...-</span><br>Decode the word that every game asks you to complete:',
        answer: 'LEVEL',
        rewardItem: { id: 'arcade_token', name: 'Golden Arcade Token', icon: 'coins', color: 'text-yellow-400' },
        solved: false
    },
    room5_hint: {
        id: 'room5_hint',
        type: 'hint',
        title: 'Arcade Hint',
        subtitle: 'ROOM 05 - HINT',
        icon: 'lightbulb',
        text: '<div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-center font-mono-code text-xs leading-relaxed">CLUE: Use the key to read the signal letter by letter: L, then E, then V, then E, then L. The word starts and ends with the same letter.</div>'
    },
    room6_vault: {
        id: 'room6_vault',
        type: 'puzzle',
        title: 'Master Quantum Vault',
        subtitle: 'ROOM 06 - VIP SANCTUARY',
        icon: 'vault',
        text: 'The vault needs a 5-digit code built from your earlier answers. Write the five parts one after another:<br><br><span class="text-purple-300 font-mono-code block my-2 text-left text-xs bg-slate-950/70 p-3 rounded-xl border border-purple-500/20">PART A: The FIRST digit of the Room 01 lock code<br>PART B: The SUM of all the digits in the Room 02 key<br>PART C: The number of letters in the decoded word from Room 03<br>PART D: The FIRST digit of the Room 04 answer<br>PART E: How many times the letter E appears in the Room 05 word</span><br>Enter the 5-digit vault code (A then B then C then D then E):',
        answer: '65542',
        rewardItem: null,
        solved: false
    },
    room6_hint: {
        id: 'room6_hint',
        type: 'hint',
        title: 'Vault Hint',
        subtitle: 'ROOM 06 - HINT',
        icon: 'lightbulb',
        text: '<div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-center font-mono-code text-xs leading-relaxed">CLUE: Every part is exactly ONE digit, so the code has 5 digits. Forgot an answer? Go back to that room and click its solved puzzle: the answer is shown there.</div>'
    }
};

// The vault code is computed from the other answers so the puzzles can never get out of sync
(function computeVaultCode() {
    const a = puzzleData.room1_tv.answer[0];
    const b = String(puzzleData.room2_terminal.answer).split('').reduce((t, d) => t + Number(d), 0);
    const c = puzzleData.room3_book.answer.length;
    const d = String(puzzleData.room4_terminal.answer)[0];
    const e = puzzleData.room5_arcade.answer.split('E').length - 1;
    puzzleData.room6_vault.answer = `${a}${b}${c}${d}${e}`;
})();

// --- THREE.JS GLOBALS ---
let scene, camera, renderer, controls;
let roomGroup;
let tvMesh, tvCanvas, tvContext, tvTexture;
let interactiveObjects = [];
let animatedProps = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let audioCtx;

// --- PROCEDURAL MARBLE & ART TEXTURES ---
function createMarbleTexture(isDark = true) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = isDark ? '#0e0e13' : '#e2e8f0';
    ctx.fillRect(0, 0, 512, 512);
    
    // Draw procedural marble veins
    for (let i = 0; i < 45; i++) {
        ctx.beginPath();
        ctx.strokeStyle = isDark 
            ? `rgba(255, 255, 255, ${Math.random() * 0.14 + 0.03})` 
            : `rgba(30, 41, 59, ${Math.random() * 0.16 + 0.04})`;
        ctx.lineWidth = Math.random() * 3 + 0.5;
        let x = Math.random() * 512;
        let y = Math.random() * 512;
        ctx.moveTo(x, y);
        for (let j = 0; j < 10; j++) {
            x += (Math.random() - 0.5) * 90;
            y += (Math.random() - 0.5) * 90;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createScreenArtTexture(primaryColor, secondaryColor, label = '') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 144;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 256, 144);
    grad.addColorStop(0, primaryColor);
    grad.addColorStop(0.5, '#09090b');
    grad.addColorStop(1, secondaryColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 144);

    // Abstract cosmic / neon waves
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(128, 72, 42, 0, Math.PI * 2);
    ctx.stroke();

    if (label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Fira Code, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, 128, 78);
    }
    return new THREE.CanvasTexture(canvas);
}

function createGamingChair(accentColor = 0xa855f7) {
    const chairGroup = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f1117, roughness: 0.6 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.3, emissive: accentColor, emissiveIntensity: 0.3 });

    // Base & Wheel Star
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), darkMat);
    stem.position.y = 0.25;
    chairGroup.add(stem);

    for (let i = 0; i < 5; i++) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.06), darkMat);
        leg.position.y = 0.05;
        leg.rotation.y = (i * Math.PI * 2) / 5;
        chairGroup.add(leg);
    }

    // Seat Cushion
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.7), darkMat);
    seat.position.y = 0.52;
    chairGroup.add(seat);

    // Backrest with Neon Trim
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.05, 0.12), darkMat);
    back.position.set(0, 1.05, 0.28);
    back.rotation.x = -0.1;
    chairGroup.add(back);

    const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 0.14), accentMat);
    trimLeft.position.set(-0.34, 1.05, 0.28);
    trimLeft.rotation.x = -0.1;
    chairGroup.add(trimLeft);

    const trimRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 0.14), accentMat);
    trimRight.position.set(0.34, 1.05, 0.28);
    trimRight.rotation.x = -0.1;
    chairGroup.add(trimRight);

    // Armrests
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.35), darkMat);
    armL.position.set(-0.4, 0.72, 0.05);
    chairGroup.add(armL);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.35), darkMat);
    armR.position.set(0.4, 0.72, 0.05);
    chairGroup.add(armR);

    return chairGroup;
}

function createPottedPlant() {
    const group = new THREE.Group();
    const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.24, 0.45, 16),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
    );
    pot.position.y = 0.225;
    group.add(pot);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    for (let i = 0; i < 12; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.65, 5), leafMat);
        const angle = (i / 12) * Math.PI * 2;
        blade.position.set(Math.cos(angle) * 0.12, 0.6, Math.sin(angle) * 0.12);
        blade.rotation.z = Math.cos(angle) * 0.45;
        blade.rotation.x = Math.sin(angle) * 0.45;
        group.add(blade);
    }
    return group;
}

// --- THREE.JS INITIALIZATION ---
function initScene() {
    const container = document.getElementById('canvas-container');
    const aspect = window.innerWidth / window.innerHeight;
    const d = 7.5;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070a);

    // Orthographic Camera for Isometric View
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 1.5, 0);

    // WebGL Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.5, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera going below floor
    controls.minDistance = 5;
    controls.maxDistance = 50;

    window.addEventListener('resize', onWindowResize);
}

function createInRoomHintObject(roomId) {
    const hintGroup = new THREE.Group();
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), glowMat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 16, 32), glowMat);
    ring.rotation.x = Math.PI / 2;
    hintGroup.add(sphere, ring);

    const hintPos = {
        1: [-2.6, 2.7, -3.8],
        2: [-3.7, 2.7, -2.0],
        3: [2.5, 2.7, -3.8],
        4: [0, 3.2, -3.8]
    };

    const pos = hintPos[roomId] || [0, 2.5, 0];
    hintGroup.position.set(pos[0], pos[1], pos[2]);
    hintGroup.userData = { interactive: true, puzzleId: `room${roomId}_hint` };

    roomGroup.add(hintGroup);
    interactiveObjects.push(hintGroup);
    animatedProps.push({ mesh: hintGroup, type: 'float' });
}

function startBrandedGame() {
    devName = document.getElementById('input-dev-name').value.trim() || 'ZD STUDIO';
    gameName = document.getElementById('input-game-name').value.trim() || 'ZD ESCAPE';

    document.getElementById('header-game-title').innerText = gameName.toUpperCase();
    document.getElementById('header-dev-badge').innerText = `BY ${devName.toUpperCase()}`;
    document.getElementById('footer-watermark').innerText = `Developed by ${devName} © 2026`;

    const startScreen = document.getElementById('start-screen');
    startScreen.classList.add('opacity-0', 'pointer-events-none');

    startTimer();
    drawTVEscapeRiddle();
    showToast(`Welcome to ${gameName}! Click objects in the room to find clues. Stuck? Use the HINT button!`);
}

window.onload = function() {
    injectLogos();
    renderInventoryUI();
    initScene();
    loadRoomScene(1);
    setupInteractivity();
    animate();
};

// --- ROOM BUILDER (HIGH-FIDELITY DESIGN MATCHING IMAGE 1, 2, 3) ---
function loadRoomScene(roomId) {
    currentRoomId = roomId;
    interactiveObjects = [];
    animatedProps = [];

    // Update UI Tab active states
    ROOM_IDS.forEach(id => {
        const btn = document.getElementById(`tab-room-${id}`);
        if (!btn) return;
        if (id === roomId) btn.classList.add('room-btn-active');
        else btn.classList.remove('room-btn-active');
    });

    const subtitle = document.getElementById('room-subtitle');
    if (roomId === 1) subtitle.innerText = "Room 01 - Cozy Neon Lounge";
    else if (roomId === 2) subtitle.innerText = "Room 02 - Marble Gaming Suite";
    else if (roomId === 3) subtitle.innerText = "Room 03 - Ultra-Neon RGB Command Center (Design 3)";
    else if (roomId === 4) subtitle.innerText = "Room 04 - Neon Server Room";
    else if (roomId === 5) subtitle.innerText = "Room 05 - Retro Arcade Hall";
    else subtitle.innerText = "Room 06 - VIP Cyber Sanctuary";

    // Clear old room group
    if (roomGroup) scene.remove(roomGroup);
    roomGroup = new THREE.Group();
    scene.add(roomGroup);

    const darkMarbleTex = createMarbleTexture(true);
    const lightMarbleTex = createMarbleTexture(false);

    // Wall & Floor materials matched to reference images
    let wallMat, floorMat;
    if (roomId === 1) {
        wallMat = new THREE.MeshStandardMaterial({ color: 0xd9c8b6, roughness: 0.9 });
        floorMat = new THREE.MeshStandardMaterial({ map: createWoodTexture(), roughness: 0.5, metalness: 0.05 });
    } else if (roomId === 2) {
        wallMat = new THREE.MeshStandardMaterial({ map: lightMarbleTex, color: 0xd6c3dc, roughness: 0.4 });
        floorMat = new THREE.MeshStandardMaterial({ map: lightMarbleTex, color: 0x7a7088, roughness: 0.3, metalness: 0.2 });
    } else if (roomId === 3) {
        wallMat = new THREE.MeshStandardMaterial({ color: 0x09090e, roughness: 0.6 });
        floorMat = new THREE.MeshStandardMaterial({ color: 0x0b0b12, roughness: 0.25, metalness: 0.5 });
    } else if (roomId === 4) {
        wallMat = new THREE.MeshStandardMaterial({ color: 0x08120e, roughness: 0.7 });
        floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1411, roughness: 0.3, metalness: 0.6 });
    } else if (roomId === 5) {
        wallMat = new THREE.MeshStandardMaterial({ color: 0x150d1f, roughness: 0.7 });
        floorMat = new THREE.MeshStandardMaterial({ color: 0x0d0a16, roughness: 0.25, metalness: 0.5 });
    } else {
        wallMat = new THREE.MeshStandardMaterial({ color: 0x110e1c, roughness: 0.65 });
        floorMat = new THREE.MeshStandardMaterial({ map: darkMarbleTex, roughness: 0.15, metalness: 0.4 });
    }
    
    // Floor & Walls
    const floor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.35, 8), floorMat);
    floor.position.set(0, -0.175, 0);
    floor.receiveShadow = true;
    roomGroup.add(floor);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.8, 8), wallMat);
    leftWall.position.set(-4.14, 2.9, 0);
    leftWall.receiveShadow = true;
    roomGroup.add(leftWall);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(8.28, 5.8, 0.28), wallMat);
    backWall.position.set(-0.14, 2.9, -4.14);
    backWall.receiveShadow = true;
    roomGroup.add(backWall);

    // Glowing LED Perimeter Strips along Wall-Floor Seam
    const ledColor = ROOM_LED_COLORS[roomId];
    const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
    
    const backSeamLED = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.06, 0.06), ledMat);
    backSeamLED.position.set(0, 0.03, -3.97);
    roomGroup.add(backSeamLED);

    const leftSeamLED = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 8.0), ledMat);
    leftSeamLED.position.set(-3.97, 0.03, 0);
    roomGroup.add(leftSeamLED);

    // Hints now live in the HINT button (bottom-right), not in the 3D room

    // Ambient & Scene Lighting
    const ambient = new THREE.AmbientLight(0xffffff, roomId === 2 ? 0.65 : 0.45);
    roomGroup.add(ambient);

    const spotLight = new THREE.DirectionalLight(0xffffff, 0.9);
    spotLight.position.set(10, 16, 10);
    spotLight.castShadow = true;
    roomGroup.add(spotLight);

    const accentPoint = new THREE.PointLight(ledColor, 1.2, 12);
    accentPoint.position.set(0, 3.5, 0);
    roomGroup.add(accentPoint);

    // BUILD SPECIFIC ROOM OBJECTS
    if (roomId === 1) buildRoom1();
    else if (roomId === 2) buildRoom2();
    else if (roomId === 3) buildRoom3();
    else if (roomId === 4) buildRoom4();
    else if (roomId === 5) buildRoom5();
    else buildRoom6();
    updateHintButton();
}
// =====================================================================
// NEW ART HELPERS (rooms 1 & 2 redesign)
// =====================================================================
const ZD_LOGO_PATHS = {
    hex: 'M32 3 57 17.5v29L32 61 7 46.5v-29z',
    z: 'M16 22H31L16 42H31',
    d: 'M35 22H40A10 10 0 0 1 40 42H35Z'
};

function zdLogoSVG(uid) {
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
        <defs>
            <linearGradient id="zdg${uid}" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#c084fc"/><stop offset="1" stop-color="#22d3ee"/>
            </linearGradient>
            <filter id="zdf${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <path d="${ZD_LOGO_PATHS.hex}" fill="#0b0b16" stroke="url(#zdg${uid})" stroke-width="3" stroke-linejoin="round" filter="url(#zdf${uid})"/>
        <g fill="none" stroke="url(#zdg${uid})" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#zdf${uid})">
            <path d="${ZD_LOGO_PATHS.z}"/><path d="${ZD_LOGO_PATHS.d}"/>
        </g>
        <circle cx="32" cy="52" r="1.8" fill="#22d3ee"/>
    </svg>`;
}

function drawZDLogoCanvas(ctx, cx, cy, size) {
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(size / 64, size / 64);
    const grad = ctx.createLinearGradient(0, 0, 64, 64);
    grad.addColorStop(0, '#c084fc');
    grad.addColorStop(1, '#22d3ee');
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#0b0b16';
    ctx.fill(new Path2D(ZD_LOGO_PATHS.hex));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(ZD_LOGO_PATHS.hex));
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.stroke(new Path2D(ZD_LOGO_PATHS.z));
    ctx.stroke(new Path2D(ZD_LOGO_PATHS.d));
    ctx.restore();
}

function addBox(parent, w, h, d, mat, x, y, z, ry) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    parent.add(m);
    return m;
}
function addCyl(parent, rt, rb, h, mat, x, y, z, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 16), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
}

function injectLogos() {
    document.querySelectorAll('[data-zd-logo]').forEach((el, i) => { el.innerHTML = zdLogoSVG(el.dataset.zdLogo + i); });
    if (!document.getElementById('zd-favicon')) {
        const link = document.createElement('link');
        link.id = 'zd-favicon';
        link.rel = 'icon';
        link.href = 'data:image/svg+xml,' + encodeURIComponent(zdLogoSVG('fav'));
        document.head.appendChild(link);
    }
}

function createWoodTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    const tones = ['#b8651b', '#a95a17', '#c4742a', '#9d5114', '#bb6a20', '#b05d18'];
    const plankH = 64;
    for (let row = 0; row < 8; row++) {
        let x = -((row * 137) % 260);
        while (x < 512) {
            const len = 230 + ((row * 41 + Math.abs(x)) % 70);
            ctx.fillStyle = tones[(row * 2 + Math.floor((x + 400) / 230)) % tones.length];
            ctx.fillRect(x, row * plankH, len, plankH);
            ctx.strokeStyle = 'rgba(60, 25, 5, 0.35)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, row * plankH, len, plankH);
            for (let g = 0; g < 7; g++) {
                ctx.strokeStyle = `rgba(70, 30, 8, ${0.08 + Math.random() * 0.12})`;
                ctx.lineWidth = 1;
                const gy = row * plankH + 6 + Math.random() * (plankH - 12);
                ctx.beginPath();
                ctx.moveTo(x + 4, gy);
                ctx.lineTo(x + len - 4, gy + (Math.random() - 0.5) * 6);
                ctx.stroke();
            }
            x += len;
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
}

function createGlowTexture(color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, color);
    g.addColorStop(0.45, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
}

function createGlowPlane(w, h, color, opacity) {
    const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
            map: createGlowTexture(color), transparent: true, opacity: opacity === undefined ? 0.8 : opacity,
            blending: THREE.AdditiveBlending, depthWrite: false
        })
    );
    return m;
}

function createBannerTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 420;
    const ctx = c.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 1024, 420);
    bg.addColorStop(0, '#070b1f');
    bg.addColorStop(1, '#14082e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 420);
    ctx.lineWidth = 6;
    const tri = (pts, col) => {
        ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 18;
        ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke();
    };
    tri([[120, 10], [512, 410], [10, 410]], '#38bdf8');
    tri([[904, 10], [512, 410], [1014, 410]], '#d946ef');
    tri([[250, 10], [512, 300], [774, 10]], '#6366f1');
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(7, 11, 31, 0.85)';
    ctx.beginPath(); ctx.arc(512, 210, 130, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 8; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(512, 210, 130, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    drawZDLogoCanvas(ctx, 512, 205, 190);
    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 30px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ZD ESCAPE', 512, 395);
    return new THREE.CanvasTexture(c);
}

function createPosterTexture(kind) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 380;
    const ctx = c.getContext('2d');
    if (kind === 'hero') {
        const bg = ctx.createLinearGradient(0, 0, 0, 380);
        bg.addColorStop(0, '#0f172a'); bg.addColorStop(1, '#3b0a45');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 380);
        ctx.fillStyle = '#0a0a12';
        ctx.beginPath(); ctx.arc(128, 130, 52, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(30, 380); ctx.quadraticCurveTo(40, 210, 128, 200); ctx.quadraticCurveTo(216, 210, 226, 380); ctx.fill();
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 4; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(128, 130, 52, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.fillStyle = '#22d3ee'; ctx.fillRect(98, 120, 60, 12);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 22px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('ESCAPE', 128, 350);
    } else {
        ctx.fillStyle = '#150a0a'; ctx.fillRect(0, 0, 256, 380);
        for (let i = 0; i < 46; i++) {
            const a = (i / 46) * Math.PI * 2, r1 = 40 + Math.random() * 30, r2 = 110 + Math.random() * 80;
            ctx.strokeStyle = `rgba(${200 + Math.random() * 55 | 0}, ${20 + Math.random() * 40 | 0}, 30, 0.85)`;
            ctx.lineWidth = 2 + Math.random() * 6;
            ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * r1, 190 + Math.sin(a) * r1); ctx.lineTo(128 + Math.cos(a) * r2, 190 + Math.sin(a) * r2); ctx.stroke();
        }
        ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.arc(128, 190, 62, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fafafa';
        ctx.beginPath(); ctx.ellipse(104, 180, 20, 12, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(152, 180, 20, 12, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath(); ctx.ellipse(106, 182, 8, 5, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(150, 182, 8, 5, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    return new THREE.CanvasTexture(c);
}

function createLetterTexture(text, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 160;
    const ctx = c.getContext('2d');
    ctx.textAlign = 'center';
    ctx.font = 'bold 120px Inter, Arial, sans-serif';
    ctx.shadowColor = color; ctx.shadowBlur = 28;
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 120);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(text, 128, 120);
    return new THREE.CanvasTexture(c);
}

function createLogoScreenTexture(title, sub) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 288;
    const ctx = c.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 512, 288);
    bg.addColorStop(0, '#05070f'); bg.addColorStop(1, '#1a0b33');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 288);
    drawZDLogoCanvas(ctx, 256, 105, 130);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9d5ff'; ctx.font = 'bold 40px Inter, sans-serif';
    ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 16;
    ctx.fillText(title, 256, 225);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#22d3ee'; ctx.font = '18px Fira Code, monospace';
    ctx.fillText(sub, 256, 258);
    return new THREE.CanvasTexture(c);
}

function createPixelSignTexture(text, fg, bg, accent) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 160;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = accent; ctx.lineWidth = 8; ctx.strokeRect(6, 6, 244, 148);
    ctx.fillStyle = fg; ctx.textAlign = 'center';
    const words = text.split(' ');
    ctx.font = 'bold 54px Fira Code, monospace';
    ctx.shadowColor = fg; ctx.shadowBlur = 10;
    ctx.fillText(words[0], 128, words.length > 1 ? 72 : 100);
    if (words[1]) ctx.fillText(words[1], 128, 134);
    return new THREE.CanvasTexture(c);
}

function createFacetTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 320;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e9e4f2'; ctx.fillRect(0, 0, 512, 320);
    const cols = 8, rows = 5, w = 512 / cols, h = 320 / rows;
    for (let r = 0; r < rows; r++) {
        for (let q = 0; q < cols; q++) {
            const x = q * w, y = r * h;
            ctx.fillStyle = `rgba(120, 90, 170, ${0.05 + ((q + r) % 3) * 0.09})`;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
            ctx.fillStyle = `rgba(255, 255, 255, ${0.35 - ((q + r) % 2) * 0.25})`;
            ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(90, 70, 130, 0.35)'; ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, w, h);
        }
    }
    return new THREE.CanvasTexture(c);
}

function createDrawerTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d9d6e0'; ctx.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = '#8b879a'; ctx.lineWidth = 3;
        ctx.strokeRect(6, 6 + i * 62, 116, 56);
        ctx.fillStyle = '#6b6780'; ctx.fillRect(40, 28 + i * 62, 48, 8);
    }
    return new THREE.CanvasTexture(c);
}

function createGlassGridTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2b2740'; ctx.fillRect(0, 0, 128, 256);
    ctx.strokeStyle = '#e9e4f2'; ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 250);
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(i * 42.6, 0); ctx.lineTo(i * 42.6, 256); ctx.stroke(); }
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, i * 51); ctx.lineTo(128, i * 51); ctx.stroke(); }
    return new THREE.CanvasTexture(c);
}

function createPlaySignTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0b0b12'; ctx.fillRect(0, 0, 256, 96);
    ctx.lineWidth = 7; ctx.shadowBlur = 12;
    const sym = (x, col, fn) => { ctx.strokeStyle = col; ctx.shadowColor = col; ctx.beginPath(); fn(x); ctx.stroke(); };
    sym(40, '#4ade80', x => { ctx.moveTo(x, 22); ctx.lineTo(x + 22, 66); ctx.lineTo(x - 22, 66); ctx.closePath(); });
    sym(100, '#f87171', x => { ctx.arc(x, 48, 22, 0, Math.PI * 2); });
    sym(160, '#60a5fa', x => { ctx.moveTo(x - 20, 28); ctx.lineTo(x + 20, 68); ctx.moveTo(x + 20, 28); ctx.lineTo(x - 20, 68); });
    sym(218, '#f472b6', x => { ctx.rect(x - 20, 28, 40, 40); });
    return new THREE.CanvasTexture(c);
}

function createUltrawideTextures() {
    const big = document.createElement('canvas');
    big.width = 1620; big.height = 288;
    const ctx = big.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 1620, 288);
    bg.addColorStop(0, '#2b0a4f'); bg.addColorStop(0.5, '#7c1fa8'); bg.addColorStop(1, '#0b2a6b');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 1620, 288);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.ellipse(810, 144, 100 + i * 60, 40 + i * 16, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9d5ff'; ctx.font = 'bold 30px Fira Code, monospace';
    ctx.fillText('PRIME + BINARY CIPHER', 810, 62);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 62px Fira Code, monospace';
    ctx.fillText('2 3 5 7 11 ?', 810, 150);
    ctx.fillStyle = '#67e8f9'; ctx.font = 'bold 40px Fira Code, monospace';
    ctx.fillText('+ BINARY(1010)', 810, 215);
    ctx.fillStyle = '#c4b5fd'; ctx.font = '20px Fira Code, monospace';
    ctx.fillText('CLICK TO ENTER THE KEY', 810, 262);
    const parts = [[0, 436], [436, 748], [1184, 436]];
    return parts.map(([sx, sw]) => {
        const c = document.createElement('canvas');
        c.width = sw; c.height = 288;
        c.getContext('2d').drawImage(big, sx, 0, sw, 288, 0, 0, sw, 288);
        return new THREE.CanvasTexture(c);
    });
}

// ROOM 1: COZY NEON LOUNGE (reference image 1)
function buildRoom1() {
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.6 });
    const consoleMat = new THREE.MeshStandardMaterial({ color: 0x34313c, roughness: 0.5, metalness: 0.15 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x24202b, roughness: 0.55 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x1a1b24, roughness: 0.32, metalness: 0.12 });
    const leatherLight = new THREE.MeshStandardMaterial({ color: 0x23242f, roughness: 0.3, metalness: 0.12 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, metalness: 0.8, roughness: 0.3 });
    const basic = c => new THREE.MeshBasicMaterial({ color: c });

    // ---- TV (interactive puzzle object) ----
    tvCanvas = document.createElement('canvas');
    tvCanvas.width = 512;
    tvCanvas.height = 288;
    tvContext = tvCanvas.getContext('2d');
    tvTexture = new THREE.CanvasTexture(tvCanvas);

    const tvGlow = createGlowPlane(6.2, 3.9, '#22d3ee', 0.85);
    tvGlow.position.set(0.7, 3.05, -3.96);
    roomGroup.add(tvGlow);

    const tvGroup = new THREE.Group();
    addBox(tvGroup, 4.0, 2.3, 0.12, blackMat, 0, 0, 0);
    const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.12), new THREE.MeshBasicMaterial({ map: tvTexture }));
    tvScreen.position.z = 0.07;
    tvGroup.add(tvScreen);
    tvGroup.position.set(0.7, 3.05, -3.88);
    tvGroup.userData = { interactive: true, puzzleId: 'room1_tv' };
    roomGroup.add(tvGroup);
    interactiveObjects.push(tvGroup);

    // ---- Wall art on the BACK wall (2 posters, tagged for the counting puzzle) ----
    function addBackPoster(x, y, w, h, kind, glowColor) {
        const glow = createGlowPlane(w + 1.6, h + 1.6, glowColor, 0.8);
        glow.position.set(x, y, -3.97);
        roomGroup.add(glow);
        const g = new THREE.Group();
        addBox(g, w + 0.1, h + 0.1, 0.05, blackMat, 0, 0, 0);
        const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: createPosterTexture(kind) }));
        art.position.z = 0.03;
        g.add(art);
        g.position.set(x, y, -3.93);
        g.userData = { tag: 'art' };
        roomGroup.add(g);
    }
    addBackPoster(-2.55, 3.15, 1.0, 1.45, 'hero', '#ec4899');
    addBackPoster(3.3, 2.95, 0.95, 1.4, 'splash', '#3b82f6');

    // ---- Wall art on the LEFT wall (neon banner + small frame) ----
    function addLeftArt(z, y, w, h, tex, glowColor, glowOpacity) {
        const glow = createGlowPlane(w + 1.8, h + 1.4, glowColor, glowOpacity);
        glow.rotation.y = Math.PI / 2;
        glow.position.set(-3.97, y, z);
        roomGroup.add(glow);
        const g = new THREE.Group();
        addBox(g, w + 0.1, h + 0.1, 0.05, blackMat, 0, 0, 0);
        const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
        art.position.z = 0.03;
        g.add(art);
        g.rotation.y = Math.PI / 2;
        g.position.set(-3.93, y, z);
        g.userData = { tag: 'art' };
        roomGroup.add(g);
    }
    addLeftArt(0.5, 3.1, 4.2, 1.72, createBannerTexture(), '#6366f1', 0.75);
    addLeftArt(-3.05, 3.25, 0.85, 1.15, createPosterTexture('hero'), '#d946ef', 0.7);

    // ---- TV console (dark wood bench) ----
    addBox(roomGroup, 4.8, 0.08, 0.82, consoleMat, 0.5, 0.72, -3.55);      // top
    addBox(roomGroup, 4.8, 0.66, 0.05, consoleMat, 0.5, 0.38, -3.93);       // back
    addBox(roomGroup, 0.08, 0.68, 0.82, consoleMat, -1.86, 0.4, -3.55);     // left end
    addBox(roomGroup, 0.08, 0.68, 0.82, consoleMat, 2.86, 0.4, -3.55);      // right end
    addBox(roomGroup, 0.06, 0.66, 0.78, consoleMat, 0.2, 0.38, -3.55);      // divider
    addBox(roomGroup, 4.8, 0.05, 0.82, consoleMat, 0.5, 0.06, -3.55);       // bottom
    addBox(roomGroup, 2.6, 0.58, 0.04, woodDark, 1.53, 0.4, -3.15);         // closed door
    addBox(roomGroup, 0.5, 0.03, 0.03, silver, 1.53, 0.6, -3.12);           // handle
    addBox(roomGroup, 1.8, 0.04, 0.78, consoleMat, -0.8, 0.4, -3.55);       // open shelf board
    addBox(roomGroup, 0.55, 0.08, 0.4, blackMat, -1.3, 0.46, -3.55);        // game console
    addBox(roomGroup, 0.22, 0.04, 0.13, blackMat, -0.55, 0.44, -3.4);       // controller
    addBox(roomGroup, 4.7, 0.03, 0.03, basic(0xd946ef), 0.5, 0.07, -3.13);  // pink neon edge
    const consoleGlow = createGlowPlane(5.8, 1.5, '#d946ef', 0.55);
    consoleGlow.rotation.x = -Math.PI / 2;
    consoleGlow.position.set(0.5, 0.02, -3.0);
    roomGroup.add(consoleGlow);

    // ---- Neon letter stands (3) ----
    const stands = [['ZD', '#f43f5e', -1.3], ['GG', '#a3e635', 0.2], ['XP', '#38bdf8', 1.5]].slice(0, ROOM1_COUNTS.stands);
    stands.forEach(([txt, col, x]) => {
        const g = new THREE.Group();
        addBox(g, 0.8, 0.06, 0.5, blackMat, 0, 0, 0);
        addBox(g, 0.8, 0.02, 0.02, basic(parseInt(col.slice(1), 16)), 0, 0.01, 0.26);
        const letter = new THREE.Mesh(
            new THREE.PlaneGeometry(0.8, 0.5),
            new THREE.MeshBasicMaterial({ map: createLetterTexture(txt, col), transparent: true })
        );
        letter.position.set(0, 0.3, 0);
        letter.rotation.x = -0.12;
        g.add(letter);
        g.position.set(x, 0.79, -3.5);
        g.userData = { tag: 'stand' };
        roomGroup.add(g);
        const glow = createGlowPlane(1.5, 0.9, col, 0.55);
        glow.rotation.x = -Math.PI / 2;
        glow.position.set(x, 0.77, -3.5);
        roomGroup.add(glow);
    });

    // ---- Books on the console (2) ----
    const bookColors = [0x1e3a8a, 0x7f1d1d];
    for (let i = 0; i < ROOM1_COUNTS.books; i++) {
        const b = addBox(roomGroup, 0.62 - i * 0.07, 0.07, 0.42 - i * 0.04, new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.7 }), 2.4, 0.795 + i * 0.07, -3.5, i * 0.28);
        b.userData = { tag: 'book' };
    }

    // ---- Black leather sofa (back toward the camera, faces the TV) ----
    const sofa = new THREE.Group();
    addBox(sofa, 3.6, 0.4, 1.25, leather, 0, 0.4, 0);
    [-1.2, 0, 1.2].forEach(sx => addBox(sofa, 1.15, 0.2, 1.0, leatherLight, sx, 0.68, -0.1));
    addBox(sofa, 3.6, 0.85, 0.3, leather, 0, 0.9, 0.5);
    [-1.2, 0, 1.2].forEach(sx => addBox(sofa, 1.1, 0.7, 0.22, leatherLight, sx, 1.0, 0.25));
    [-1.95, 1.95].forEach(ax => addBox(sofa, 0.3, 0.75, 1.25, leather, ax, 0.62, 0));
    [[-1.7, -0.5], [1.7, -0.5], [-1.7, 0.5], [1.7, 0.5]].forEach(([lx, lz]) => addCyl(sofa, 0.05, 0.05, 0.2, silver, lx, 0.1, lz, 8));
    sofa.position.set(-0.2, 0, 0.9);
    roomGroup.add(sofa);

    // ---- Side table + warm lamp ----
    addCyl(roomGroup, 0.35, 0.35, 0.06, woodDark, 2.5, 0.58, 0.4, 20);
    addCyl(roomGroup, 0.05, 0.05, 0.55, silver, 2.5, 0.3, 0.4, 8);
    addCyl(roomGroup, 0.22, 0.22, 0.03, silver, 2.5, 0.02, 0.4, 16);
    addCyl(roomGroup, 0.03, 0.03, 0.4, silver, 2.5, 0.82, 0.4, 8);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfde68a, side: THREE.DoubleSide }));
    shade.position.set(2.5, 1.12, 0.4);
    roomGroup.add(shade);

    // ---- Plant ----
    const plant = createPottedPlant();
    plant.position.set(3.4, 0, -3.3);
    roomGroup.add(plant);

    drawTVEscapeRiddle();
}

// ROOM 2: MARBLE GAMING SUITE (reference image 2)
function buildRoom2() {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf1eef7, roughness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1a22, roughness: 0.55 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x1f1714, roughness: 0.6 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x17171e, roughness: 0.35, metalness: 0.1 });
    const leatherLight = new THREE.MeshStandardMaterial({ color: 0x22222b, roughness: 0.3, metalness: 0.1 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xc4c7d2, metalness: 0.8, roughness: 0.3 });
    const basic = c => new THREE.MeshBasicMaterial({ color: c });

    // ================= LEFT WALL (TV side) =================
    const tvGlow = createGlowPlane(5.4, 3.7, '#a855f7', 0.85);
    tvGlow.rotation.y = Math.PI / 2;
    tvGlow.position.set(-3.97, 3.0, 0.9);
    roomGroup.add(tvGlow);
    const tvBoard = addBox(roomGroup, 0.1, 1.95, 3.35, darkMat, -3.93, 3.0, 0.9);
    const tvFace = new THREE.Mesh(new THREE.PlaneGeometry(3.15, 1.78), new THREE.MeshBasicMaterial({ map: createLogoScreenTexture('ZD GAMING', 'PLAY. SOLVE. ESCAPE.') }));
    tvFace.rotation.y = Math.PI / 2;
    tvFace.position.set(-3.87, 3.0, 0.9);
    roomGroup.add(tvFace);

    // White TV console + soundbar + console + PlayStation sign
    addBox(roomGroup, 0.75, 0.5, 3.7, whiteMat, -3.58, 0.25, 0.9);
    addBox(roomGroup, 0.14, 0.1, 2.0, darkMat, -3.74, 0.55, 0.9);
    addBox(roomGroup, 0.4, 0.1, 0.34, whiteMat, -3.5, 0.55, -0.5);
    addBox(roomGroup, 0.38, 0.03, 0.26, darkMat, -3.5, 0.62, -0.5);
    const playSign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.23), new THREE.MeshBasicMaterial({ map: createPlaySignTexture() }));
    playSign.rotation.y = Math.PI / 4;
    playSign.position.set(-3.3, 0.64, 2.45);
    roomGroup.add(playSign);
    const consoleGlow = createGlowPlane(2.2, 5, '#a855f7', 0.6);
    consoleGlow.rotation.x = -Math.PI / 2;
    consoleGlow.position.set(-3.0, 0.02, 0.9);
    roomGroup.add(consoleGlow);

    // Floor lamp
    addCyl(roomGroup, 0.22, 0.22, 0.04, darkMat, -3.55, 0.02, 3.3, 16);
    addCyl(roomGroup, 0.025, 0.025, 2.9, darkMat, -3.55, 1.45, 3.3, 8);
    const lamp1 = new THREE.Mesh(new THREE.SphereGeometry(0.2), basic(0xfff4cc));
    lamp1.position.set(-3.55, 2.95, 3.3);
    const lamp2 = new THREE.Mesh(new THREE.SphereGeometry(0.12), basic(0xfff4cc));
    lamp2.position.set(-3.55, 2.35, 3.3);
    roomGroup.add(lamp1, lamp2);

    // White cabinet + coffee machine + wall shelf
    addBox(roomGroup, 0.8, 1.5, 1.4, whiteMat, -3.52, 0.75, -2.6);
    const glassTex = createGlassGridTexture();
    [-2.95, -2.25].forEach(gz => {
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.1), new THREE.MeshBasicMaterial({ map: glassTex }));
        glass.rotation.y = Math.PI / 2;
        glass.position.set(-3.11, 0.8, gz);
        roomGroup.add(glass);
    });
    addBox(roomGroup, 0.42, 0.4, 0.36, darkMat, -3.55, 1.7, -2.6);
    addCyl(roomGroup, 0.06, 0.06, 0.15, silver, -3.35, 1.62, -2.6, 10);
    addBox(roomGroup, 0.38, 0.07, 1.6, whiteMat, -3.8, 3.35, -2.6);
    addCyl(roomGroup, 0.09, 0.11, 0.38, new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 }), -3.8, 3.58, -3.0, 12);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshStandardMaterial({ color: 0xf1c27d }));
    head.position.set(-3.8, 3.86, -3.0);
    roomGroup.add(head);
    const smallPlant = createPottedPlant();
    smallPlant.scale.set(0.45, 0.45, 0.45);
    smallPlant.position.set(-3.8, 3.38, -2.2);
    roomGroup.add(smallPlant);

    // ================= BACK WALL =================
    // Door
    addBox(roomGroup, 1.45, 3.65, 0.06, new THREE.MeshStandardMaterial({ color: 0x120d0b }), -2.35, 1.83, -3.97);
    addBox(roomGroup, 1.25, 3.5, 0.1, doorMat, -2.35, 1.75, -3.93);
    addBox(roomGroup, 0.05, 0.35, 0.06, silver, -1.85, 1.7, -3.85);

    // Mini fridge + LEVEL UP sign
    addBox(roomGroup, 0.75, 1.2, 0.75, darkMat, -1.15, 0.6, -3.55);
    const fridgeGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.95), basic(0xb04cf0));
    fridgeGlass.position.set(-1.15, 0.6, -3.17);
    roomGroup.add(fridgeGlass);
    [0.35, 0.6, 0.85].forEach(sy => addBox(roomGroup, 0.6, 0.02, 0.02, basic(0xf5d0fe), -1.15, sy, -3.16));
    addBox(roomGroup, 0.62, 0.42, 0.28, darkMat, -1.15, 1.41, -3.65);
    const levelSign = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.34), new THREE.MeshBasicMaterial({ map: createPixelSignTexture('LEVEL UP', '#4ade80', '#0a1a0f', '#4ade80') }));
    levelSign.position.set(-1.15, 1.41, -3.505);
    roomGroup.add(levelSign);

    // Geometric acoustic wall panel + shelf + signs + AC
    const facet = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.5), new THREE.MeshStandardMaterial({ map: createFacetTexture(), roughness: 0.7 }));
    facet.position.set(1.45, 2.85, -3.98);
    roomGroup.add(facet);
    addBox(roomGroup, 4.2, 0.07, 0.36, darkMat, 1.4, 3.55, -3.8);
    const gameOver = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.36), new THREE.MeshBasicMaterial({ map: createPixelSignTexture('GAME OVER', '#facc15', '#0b0b12', '#e2e8f0') }));
    gameOver.position.set(-0.25, 3.78, -3.72);
    roomGroup.add(gameOver);
    addBox(roomGroup, 0.6, 0.38, 0.2, darkMat, -0.25, 3.77, -3.8);
    const shelfPlant = createPottedPlant();
    shelfPlant.scale.set(0.35, 0.35, 0.35);
    shelfPlant.position.set(1.0, 3.6, -3.8);
    roomGroup.add(shelfPlant);
    addBox(roomGroup, 0.75, 0.03, 0.24, basic(0xf472b6), 1.9, 3.6, -3.78);
    [0xf43f5e, 0x38bdf8, 0xfacc15].forEach((c, i) => addBox(roomGroup, 0.09, 0.3, 0.2, new THREE.MeshStandardMaterial({ color: c }), 2.9 + i * 0.1, 3.73, -3.8));
    addBox(roomGroup, 1.9, 0.5, 0.42, whiteMat, 1.4, 4.75, -3.78);
    addBox(roomGroup, 1.7, 0.03, 0.02, darkMat, 1.4, 4.64, -3.56);

    // Desk: top, left leg, right drawer unit, PC tower
    addBox(roomGroup, 3.3, 0.07, 1.0, whiteMat, 1.1, 1.1, -3.45);
    addBox(roomGroup, 0.06, 1.07, 0.9, whiteMat, -0.52, 0.55, -3.45);
    const drawer = addBox(roomGroup, 0.85, 1.1, 0.95, whiteMat, 3.15, 0.55, -3.45);
    const drawerFace = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.05), new THREE.MeshBasicMaterial({ map: createDrawerTexture() }));
    drawerFace.position.set(3.15, 0.55, -2.97);
    roomGroup.add(drawerFace);
    addBox(roomGroup, 0.52, 0.8, 0.62, whiteMat, 3.15, 1.5, -3.45);
    addBox(roomGroup, 0.04, 0.6, 0.45, basic(0xa855f7), 2.88, 1.5, -3.45);

    // Keyboard, mouse pad, mic arm
    addBox(roomGroup, 1.3, 0.01, 0.55, darkMat, 1.2, 1.15, -3.15);
    addBox(roomGroup, 0.78, 0.03, 0.24, basic(0xf472b6), 0.95, 1.18, -3.12);
    addBox(roomGroup, 0.1, 0.03, 0.16, whiteMat, 1.75, 1.18, -3.1);
    addCyl(roomGroup, 0.018, 0.018, 0.9, darkMat, 2.35, 1.55, -3.6, 8);
    addCyl(roomGroup, 0.04, 0.04, 0.15, darkMat, 2.35, 2.0, -3.4, 8);

    // Interactive curved ultrawide monitor (3 angled segments)
    const [texL, texC, texR] = createUltrawideTextures();
    const monitor = new THREE.Group();
    const segMat = t => new THREE.MeshBasicMaterial({ map: t });
    const segC = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.05), segMat(texC));
    const segL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.05), segMat(texL));
    segL.position.set(-0.96, 0, 0.12);
    segL.rotation.y = 0.4;
    const segR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.05), segMat(texR));
    segR.position.set(0.96, 0, 0.12);
    segR.rotation.y = -0.4;
    monitor.add(segC, segL, segR);
    const monStand = addBox(monitor, 0.14, 0.4, 0.1, darkMat, 0, -0.62, -0.03);
    monitor.scale.set(1.2, 1.2, 1.2);
    monitor.position.set(1.1, 2.05, -3.62);
    monitor.userData = { interactive: true, puzzleId: 'room2_terminal' };
    roomGroup.add(monitor);
    interactiveObjects.push(monitor);

    // Chair + round rug
    const chair = createGamingChair(0x8b5cf6);
    chair.position.set(1.1, 0, -2.3);
    roomGroup.add(chair);
    addCyl(roomGroup, 1.0, 1.0, 0.02, new THREE.MeshStandardMaterial({ color: 0xe8e4f0, roughness: 0.9 }), 1.1, 0.011, -2.3, 32);

    // ================= FOREGROUND =================
    // Rug + coffee table + shisha + mugs
    const lounge = new THREE.Group();
    addBox(lounge, 2.8, 0.02, 2.0, new THREE.MeshStandardMaterial({ color: 0x1a1523, roughness: 0.95 }), -0.1, 0.011, 0.9);
    const tableGlass = new THREE.MeshStandardMaterial({ color: 0x251d33, roughness: 0.15, metalness: 0.5 });
    addBox(lounge, 1.6, 0.06, 1.0, tableGlass, -0.1, 0.42, 0.9);
    addBox(lounge, 1.45, 0.04, 0.85, darkMat, -0.1, 0.14, 0.9);
    [[-0.8, 0.45], [0.6, 0.45], [-0.8, 1.35], [0.6, 1.35]].forEach(([lx, lz]) => addBox(lounge, 0.05, 0.4, 0.05, silver, lx, 0.2, lz));
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8963e, metalness: 0.8, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.13), gold);
    base.position.set(-0.25, 0.58, 0.8);
    lounge.add(base);
    addCyl(lounge, 0.04, 0.04, 0.4, gold, -0.25, 0.85, 0.8, 8);
    addCyl(lounge, 0.09, 0.05, 0.1, gold, -0.25, 1.08, 0.8, 10);
    const mugMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
    addCyl(lounge, 0.07, 0.07, 0.1, mugMat, 0.2, 0.5, 0.6, 12);
    addCyl(lounge, 0.07, 0.07, 0.1, mugMat, 0.3, 0.5, 1.2, 12);

    lounge.position.set(-0.7, 0, -0.5);
    roomGroup.add(lounge);

    // L-shaped sofa (back toward the camera, faces the TV) with purple underglow
    const sofa = new THREE.Group();
    addBox(sofa, 1.3, 0.4, 3.2, leather, 0, 0.4, 0);                  // main base
    [-1.0, 0, 1.0].forEach(sz => addBox(sofa, 0.95, 0.2, 0.95, leatherLight, -0.1, 0.68, sz));
    addBox(sofa, 0.32, 0.9, 3.2, leather, 0.5, 0.88, 0);              // backrest (toward camera)
    [-1.0, 0, 1.0].forEach(sz => addBox(sofa, 0.2, 0.62, 0.95, leatherLight, 0.28, 0.98, sz));
    [-1.6, 1.6].forEach(az => addBox(sofa, 1.3, 0.72, 0.3, leather, 0, 0.62, az)); // arms
    addBox(sofa, 2.4, 0.4, 1.1, leather, -1.1, 0.4, 1.75);            // chaise
    addBox(sofa, 2.2, 0.2, 0.95, leatherLight, -1.1, 0.68, 1.75);
    addBox(sofa, 2.4, 0.04, 0.06, basic(0xc084fc), -1.1, 0.07, 2.32);
    addBox(sofa, 0.06, 0.04, 3.2, basic(0xc084fc), 0.62, 0.07, 0);
    addBox(sofa, 0.06, 0.04, 1.1, basic(0xc084fc), -2.28, 0.07, 1.75);
    sofa.position.set(2.0, 0, -0.1);
    roomGroup.add(sofa);
    const sofaGlow = createGlowPlane(4.6, 6.0, '#a855f7', 0.55);
    sofaGlow.rotation.x = -Math.PI / 2;
    sofaGlow.position.set(1.4, 0.02, 1.0);
    roomGroup.add(sofaGlow);
}

// ROOM 3: ULTRA-NEON RGB COMMAND CENTER (MATCHING IMAGE 3)
function buildRoom3() {
    const neonRedMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xd946ef });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const darkDeskMat = new THREE.MeshStandardMaterial({ color: 0x09090d, roughness: 0.25, metalness: 0.6 });

    // Ceiling Neon Strip Rectangles (Image 3 signature ceiling lights)
    const ceilFront = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, 0.06), neonRedMat);
    ceilFront.position.set(0, 5.5, 1.5);
    const ceilBack = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, 0.06), neonRedMat);
    ceilBack.position.set(0, 5.5, -2.5);
    const ceilLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 4.0), neonPinkMat);
    ceilLeft.position.set(-3.25, 5.5, -0.5);
    const ceilRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 4.0), neonRedMat);
    ceilRight.position.set(3.25, 5.5, -0.5);
    roomGroup.add(ceilFront, ceilBack, ceilLeft, ceilRight);

    // LEFT WALL: Large Glowing Neon Display Frame & Streaming Station (Image 3 left side)
    const leftDesk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 3.4), darkDeskMat);
    leftDesk.position.set(-3.3, 0.48, 0.3);
    const leftDeskEdge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3.4), neonPinkMat);
    leftDeskEdge.position.set(-2.65, 0.95, 0.3);
    roomGroup.add(leftDesk, leftDeskEdge);

    const leftWallScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, 1.45),
        new THREE.MeshBasicMaterial({ map: createScreenArtTexture('#3b82f6', '#d946ef', 'FUTUREX') })
    );
    leftWallScreen.rotation.y = Math.PI / 2;
    leftWallScreen.position.set(-3.94, 3.0, 0.3);
    roomGroup.add(leftWallScreen);

    const leftChair = createGamingChair(0xd946ef);
    leftChair.rotation.y = -Math.PI / 2;
    leftChair.position.set(-2.0, 0, 0.3);
    roomGroup.add(leftChair);

    // BACK WALL: Red Neon Arch + Main Cyber Battle Station (Image 3 right side)
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.06), neonRedMat);
    archTop.position.set(0.8, 3.6, -3.94);
    const archLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.06), neonRedMat);
    archLeft.position.set(-0.9, 2.4, -3.94);
    const archRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.06), neonRedMat);
    archRight.position.set(2.5, 2.4, -3.94);
    roomGroup.add(archTop, archLeft, archRight);

    const mainDesk = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.95, 1.35), darkDeskMat);
    mainDesk.position.set(0.8, 0.48, -3.3);
    const mainDeskEdge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.05, 0.05), neonRedMat);
    mainDeskEdge.position.set(0.8, 0.95, -2.62);
    roomGroup.add(mainDesk, mainDeskEdge);

    // Interactive Main Cyber Monitor
    const monitorScreen = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 1.15, 0.08),
        new THREE.MeshBasicMaterial({ map: createScreenArtTexture('#ff0055', '#00f0ff', 'RIDDLE') })
    );
    monitorScreen.position.set(0.8, 1.75, -3.45);
    monitorScreen.userData = { interactive: true, puzzleId: 'room3_book' };
    roomGroup.add(monitorScreen);
    interactiveObjects.push(monitorScreen);

    // Glowing RGB Tower Units & Speakers
    const towerLeft = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 0.75), darkDeskMat);
    towerLeft.position.set(-1.6, 0.48, -3.2);
    const towerGlow = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.78), neonRedMat);
    towerGlow.position.set(-1.6, 0.04, -3.2);
    roomGroup.add(towerLeft, towerGlow);

    const mainChair = createGamingChair(0xff0055);
    mainChair.position.set(0.8, 0, -2.0);
    roomGroup.add(mainChair);
}

// --- SHARED: canvas text screen for new rooms ---
function createTextScreenTexture(lines, borderColor, bgColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 288;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor || '#04100a';
    ctx.fillRect(0, 0, 512, 288);
    ctx.strokeStyle = borderColor || '#22c55e';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 272);
    ctx.textAlign = 'center';
    lines.forEach(l => {
        ctx.fillStyle = l.color || '#e2e8f0';
        ctx.font = 'bold ' + (l.size || 22) + 'px Fira Code, monospace';
        ctx.fillText(l.text, 256, l.y);
    });
    return new THREE.CanvasTexture(canvas);
}

// ROOM 4: NEON SERVER ROOM
function buildRoom4() {
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x0c1412, roughness: 0.5, metalness: 0.6 });
    const unitMat = new THREE.MeshStandardMaterial({ color: 0x1a2622, roughness: 0.4, metalness: 0.7 });
    const trimMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const ledColors = [0x22c55e, 0x38bdf8, 0xf59e0b, 0x22c55e];

    function addRack(x, z, rotY, seed) {
        const rack = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.4, 1.0), rackMat);
        body.position.y = 1.7;
        rack.add(body);
        for (let k = 0; k < 8; k++) {
            const unit = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.04), unitMat);
            unit.position.set(0, 0.5 + k * 0.4, 0.52);
            rack.add(unit);
            const led = new THREE.Mesh(
                new THREE.BoxGeometry(0.07, 0.07, 0.03),
                new THREE.MeshBasicMaterial({ color: ledColors[(k + seed) % ledColors.length] })
            );
            led.position.set(-0.38, 0.5 + k * 0.4, 0.55);
            rack.add(led);
            if (k % 2 === 0) animatedProps.push({ mesh: led, type: 'blink', speed: 3 + k * 0.7, phase: k + seed });
        }
        const topGlow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.0), trimMat);
        topGlow.position.y = 3.42;
        rack.add(topGlow);
        rack.position.set(x, 0, z);
        rack.rotation.y = rotY;
        roomGroup.add(rack);
    }

    [-2.6, -1.3, 0, 1.3, 2.6].forEach((x, i) => addRack(x, -3.3, 0, i));
    [-1.9, -0.6, 0.7].forEach((z, i) => addRack(-3.3, z, Math.PI / 2, i + 2));

    // Ceiling neon strips
    const ceilA = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, 0.06), trimMat);
    ceilA.position.set(0, 5.5, 1.5);
    const ceilB = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, 0.06), trimMat);
    ceilB.position.set(0, 5.5, -2.5);
    roomGroup.add(ceilA, ceilB);

    // Floor cable trays
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x111c18, roughness: 0.5, metalness: 0.4 });
    const trayA = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 2.6), trayMat);
    trayA.position.set(0.9, 0.02, -1.9);
    const trayB = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.03, 0.18), trayMat);
    trayB.position.set(0, 0.02, -2.6);
    roomGroup.add(trayA, trayB);

    // Terminal desk
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x0a0f0d, roughness: 0.3, metalness: 0.6 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.95, 1.3), deskMat);
    desk.position.set(0.9, 0.48, -0.6);
    const deskEdge = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 0.05), trimMat);
    deskEdge.position.set(0.9, 0.96, 0.06);
    roomGroup.add(desk, deskEdge);

    // Interactive monitor
    const screenTex = createTextScreenTexture([
        { text: 'SERVER LOAD MONITOR', size: 20, color: '#22c55e', y: 58 },
        { text: '2  6  12  20  30  ?', size: 34, color: '#ffffff', y: 150 },
        { text: 'ENTER THE NEXT VALUE', size: 16, color: '#94a3b8', y: 235 }
    ], '#22c55e', '#04100a');
    const monitor = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.2, 0.08),
        new THREE.MeshBasicMaterial({ map: screenTex })
    );
    monitor.position.set(0.9, 1.75, -0.95);
    monitor.userData = { interactive: true, puzzleId: 'room4_terminal' };
    roomGroup.add(monitor);
    interactiveObjects.push(monitor);

    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.2), deskMat);
    stand.position.set(0.9, 1.05, -0.95);
    roomGroup.add(stand);

    const chair = createGamingChair(0x22c55e);
    chair.position.set(0.9, 0, 0.9);
    roomGroup.add(chair);
}

// ROOM 5: RETRO ARCADE HALL
function buildRoom5() {
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0b0b12, roughness: 0.5 });

    function addCabinet(x, z, bodyColor, screenTex, puzzleId) {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.3 });

        const lower = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.0), bodyMat);
        lower.position.set(0, 0.55, 0);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.8), darkMat);
        deck.position.set(0, 1.18, 0.2);
        deck.rotation.x = 0.25;
        const upper = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 0.8), bodyMat);
        upper.position.set(0, 2.0, -0.1);
        const marquee = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.9), new THREE.MeshBasicMaterial({ color: bodyColor }));
        marquee.position.set(0, 3.0, -0.05);
        g.add(lower, deck, upper, marquee);

        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 10), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 }));
        stick.position.set(-0.4, 1.36, 0.22);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
        ball.position.set(-0.4, 1.54, 0.22);
        g.add(stick, ball);
        [0.05, 0.3, 0.55].forEach((bx, i) => {
            const btn = new THREE.Mesh(
                new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12),
                new THREE.MeshBasicMaterial({ color: [0x22c55e, 0x38bdf8, 0xfacc15][i] })
            );
            btn.position.set(bx, 1.3, 0.28);
            g.add(btn);
        });

        const screen = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.95, 0.04), new THREE.MeshBasicMaterial({ map: screenTex }));
        screen.position.set(0, 2.0, 0.32);
        g.add(screen);
        if (puzzleId) {
            screen.userData = { interactive: true, puzzleId: puzzleId };
            interactiveObjects.push(screen);
        }

        g.position.set(x, 0, z);
        roomGroup.add(g);
    }

    const morseTex = createTextScreenTexture([
        { text: 'SIGNAL DETECTED', size: 22, color: '#f59e0b', y: 62 },
        { text: '.-.. . ...- . .-..', size: 30, color: '#ffffff', y: 150 },
        { text: 'L=.-..  E=.  V=...-', size: 17, color: '#94a3b8', y: 232 }
    ], '#f59e0b', '#14091f');
    const coinTex = createTextScreenTexture([
        { text: 'INSERT COIN', size: 34, color: '#ec4899', y: 160 }
    ], '#ec4899', '#14091f');
    const overTex = createTextScreenTexture([
        { text: 'GAME OVER', size: 34, color: '#38bdf8', y: 160 }
    ], '#38bdf8', '#14091f');

    addCabinet(-2.5, -3.3, 0x7c3aed, coinTex, null);
    addCabinet(0, -3.3, 0xf59e0b, morseTex, 'room5_arcade');
    addCabinet(2.5, -3.3, 0xec4899, overTex, null);

    // Left wall neon sign
    const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, 1.45),
        new THREE.MeshBasicMaterial({ map: createScreenArtTexture('#f59e0b', '#ec4899', 'ARCADE') })
    );
    sign.rotation.y = Math.PI / 2;
    sign.position.set(-3.94, 3.0, 0.3);
    roomGroup.add(sign);

    // Neon floor rings
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.04, 8, 48), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
    ringA.rotation.x = Math.PI / 2;
    ringA.position.set(0, 0.03, 0.6);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.04, 8, 48), new THREE.MeshBasicMaterial({ color: 0xec4899 }));
    ringB.rotation.x = Math.PI / 2;
    ringB.position.set(0, 0.03, 0.6);
    roomGroup.add(ringA, ringB);

    // Stools
    [[-2.3, 0.4], [-2.3, 1.6]].forEach(([sx, sz]) => {
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.4 }));
        seat.position.set(sx, 0.62, sz);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.8 }));
        leg.position.set(sx, 0.3, sz);
        roomGroup.add(seat, leg);
    });

    // Spinning coins
    [[-1.2, 2.2, 1.2], [1.4, 2.6, 0.4], [0.2, 2.0, 2.0]].forEach(([cx, cy, cz]) => {
        const coinGroup = new THREE.Group();
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
        coin.rotation.x = Math.PI / 2;
        coinGroup.add(coin);
        coinGroup.position.set(cx, cy, cz);
        roomGroup.add(coinGroup);
        animatedProps.push({ mesh: coinGroup, type: 'rotate' });
    });

    // Ceiling neon strips
    const amberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const pinkMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, 0.06), amberMat);
    c1.position.set(0, 5.5, 1.5);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, 0.06), pinkMat);
    c2.position.set(0, 5.5, -2.5);
    roomGroup.add(c1, c2);
}

// ROOM 6: VIP CYBER SANCTUARY (FINAL VAULT)
function buildRoom6() {
    // Pillars + floor ring
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1a1530, metalness: 0.7, roughness: 0.25 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    [[-3, -3], [3, -3], [-3, 3]].forEach(([px, pz]) => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 3.6, 16), pillarMat);
        pillar.position.set(px, 1.8, pz);
        const cap = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 24), glowMat);
        cap.rotation.x = Math.PI / 2;
        cap.position.set(px, 3.4, pz);
        roomGroup.add(pillar, cap);
    });
    const floorRing = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.05, 8, 64), glowMat);
    floorRing.rotation.x = Math.PI / 2;
    floorRing.position.set(0, 0.03, 0);
    roomGroup.add(floorRing);

    // Master Safe Vault Chest
    const vaultGroup = new THREE.Group();
    const vaultMat = new THREE.MeshStandardMaterial({ color: 0x0f0c1b, metalness: 0.9, roughness: 0.2 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.8, roughness: 0.1, emissive: 0x7e22ce, emissiveIntensity: 0.4 });

    const chest = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.4), vaultMat);
    const lockRing = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.14, 16, 32), ringMat);
    lockRing.position.z = 1.25;

    vaultGroup.add(chest);
    vaultGroup.add(lockRing);
    vaultGroup.position.set(0, 1.2, 0);
    vaultGroup.userData = { interactive: true, puzzleId: 'room6_vault' };
    roomGroup.add(vaultGroup);
    interactiveObjects.push(vaultGroup);
    animatedProps.push({ mesh: lockRing, type: 'spin' });
}

// --- TV RENDERER ---
function drawTVEscapeRiddle() {
    if (!tvContext) return;
    tvContext.fillStyle = '#05050b';
    tvContext.fillRect(0, 0, 512, 288);

    // Glowing Border
    tvContext.strokeStyle = '#06b6d4';
    tvContext.lineWidth = 8;
    tvContext.strokeRect(10, 10, 492, 268);

    // Header Title
    tvContext.fillStyle = '#38bdf8';
    tvContext.font = 'bold 22px Cairo, Inter';
    tvContext.textAlign = 'center';
    tvContext.fillText(`SECURITY LOCK: ${gameName}`, 256, 52);

    // Code Line
    tvContext.fillStyle = '#e2e8f0';
    tvContext.font = '18px Fira Code, monospace';
    tvContext.fillText('[LETTER STANDS] - [WALL ART] - [BOOKS]', 256, 125);

    tvContext.fillStyle = '#a855f7';
    tvContext.font = 'bold 16px Inter';
    tvContext.fillText('Count what you see in the room & click TV to unlock', 256, 180);

    tvContext.fillStyle = '#64748b';
    tvContext.font = '14px Fira Code, monospace';
    tvContext.fillText(`DEV: ${devName}`, 256, 232);

    tvTexture.needsUpdate = true;
}

// --- INTERACTION & RAYCASTING ---
function setupInteractivity() {
    const container = document.getElementById('canvas-container');
    container.addEventListener('pointerdown', onPointerDown);
}

function onPointerDown(event) {
    // Only respond to main click
    if (event.button !== 0) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactiveObjects, true);

    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData.puzzleId && obj.parent) {
            obj = obj.parent;
        }
        if (obj && obj.userData.puzzleId) {
            openPuzzleModal(obj.userData.puzzleId);
        }
    }
}

// --- PUZZLE MODAL SYSTEM ---
function openPuzzleModal(puzzleId) {
    const data = puzzleData[puzzleId];
    if (!data) return;

    currentPuzzle = data;
    const isHint = data.type === 'hint';
    const card = document.getElementById('puzzle-card');
    const iconBox = document.getElementById('puzzle-icon-box');

    card.style.borderColor = isHint ? 'rgba(245, 158, 11, 0.6)' : 'rgba(168, 85, 247, 0.4)';
    iconBox.className = 'w-10 h-10 rounded-xl flex items-center justify-center ' +
        (isHint ? 'bg-amber-500/20 text-amber-300' : 'bg-purple-500/20 text-purple-300');
    document.getElementById('puzzle-title').innerText = isHint ? 'Hint' : data.title;
    document.getElementById('puzzle-subtitle').innerText = data.subtitle;

    let body = data.text;
    if (!isHint && data.solved) {
        body += '<div class="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-center font-mono-code text-sm">SOLVED - Answer: <b>' + data.answer + '</b></div>';
    }
    document.getElementById('puzzle-body').innerHTML = body;

    const inputArea = document.getElementById('puzzle-answer-input').parentElement;
    if (isHint || data.solved) {
        inputArea.style.display = 'none';
    } else {
        inputArea.style.display = 'flex';
        document.getElementById('puzzle-answer-input').value = '';
    }

    iconBox.innerHTML = `<i data-lucide="${data.icon}" class="w-5 h-5"></i>`;
    safeIcons();

    const modal = document.getElementById('puzzle-modal');
    modal.classList.remove('opacity-0', 'pointer-events-none');
}

// --- HINT BUTTON ---
function useHint() {
    const rid = currentRoomId;
    const puzzle = puzzleData[ROOM_PUZZLE_IDS[rid]];
    if (puzzle && puzzle.solved) {
        showToast('This room is already solved!');
        return;
    }
    if (!hintsUsedRooms.has(rid)) {
        hintsUsedRooms.add(rid);
        if (HINT_COST > 0) {
            playerScore = Math.max(0, playerScore - HINT_COST);
            updateScoreDisplay();
            showToast(`Hint unlocked (-${HINT_COST} pts)`);
        }
    }
    openPuzzleModal(`room${rid}_hint`);
    updateHintButton();
}

function updateHintButton() {
    const btn = document.getElementById('hint-btn');
    const sub = document.getElementById('hint-sub');
    if (!btn || !sub) return;
    const puzzle = puzzleData[ROOM_PUZZLE_IDS[currentRoomId]];
    if (puzzle && puzzle.solved) {
        btn.classList.add('disabled');
        sub.innerText = 'SOLVED';
    } else {
        btn.classList.remove('disabled');
        sub.innerText = hintsUsedRooms.has(currentRoomId) ? 'free again' : (HINT_COST > 0 ? `-${HINT_COST} pts` : 'free');
    }
}

function closePuzzleModal() {
    const modal = document.getElementById('puzzle-modal');
    modal.classList.add('opacity-0', 'pointer-events-none');
    currentPuzzle = null;
}

function submitPuzzleAnswer() {
    if (!currentPuzzle || currentPuzzle.type === 'hint' || currentPuzzle.solved) return;

    const inputVal = document.getElementById('puzzle-answer-input').value.trim();
    const isCorrect = inputVal.toUpperCase() === currentPuzzle.answer.toUpperCase() ||
                      (currentPuzzle.altAnswer && inputVal.toUpperCase() === currentPuzzle.altAnswer.toUpperCase());

    if (isCorrect) {
        playSuccessSynthSound();
        const solvedPuzzle = currentPuzzle;
        const solvedRoomId = currentRoomId;
        solvedPuzzle.solved = true;
        playerScore += 250;
        updateScoreDisplay();

        if (solvedPuzzle.rewardItem) {
            addItemToInventory(solvedPuzzle.rewardItem);
            showToast(`Success! Item acquired: ${solvedPuzzle.rewardItem.name}`);
        }

        closePuzzleModal();
        document.getElementById('puzzle-answer-input').value = '';

        updateHintButton();

        if (solvedRoomId < TOTAL_ROOMS) {
            // Unlock the next room and move there automatically
            const nextRoom = solvedRoomId + 1;
            roomUnlocked[nextRoom] = true;
            showToast(`Room 0${nextRoom} unlocked! Moving there...`);
            setTimeout(() => {
                if (currentRoomId === solvedRoomId) switchRoom(nextRoom);
            }, 1500);
        } else if (solvedPuzzle.id === 'room6_vault') {
            setTimeout(triggerVictoryScreen, 800);
        }
    } else {
        playErrorSynthSound();
        showToast('Incorrect passcode! Try again.');
    }
}

// --- INVENTORY MANAGEMENT ---
function addItemToInventory(item) {
    if (inventory.find(i => i.id === item.id)) return;
    inventory.push(item);
    lastAddedItemId = item.id;
    renderInventoryUI();
}

// Hand-drawn SVG art for every collectible item
const ITEM_ART = {
    keycard_blue: `<svg viewBox="0 0 48 48"><defs><linearGradient id="ia1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#67e8f9"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>
        <g transform="rotate(-18 24 24)"><rect x="4" y="11" width="40" height="26" rx="4" fill="url(#ia1)" stroke="#e0f2fe" stroke-width="1.3"/>
        <rect x="4" y="17" width="40" height="5" fill="#0b1b3a" opacity=".85"/><rect x="9" y="26" width="10" height="7" rx="1.5" fill="#fde68a" stroke="#b45309" stroke-width=".7"/>
        <path d="M24 28h15M24 32h9" stroke="#e0f2fe" stroke-width="1.7" stroke-linecap="round" opacity=".85"/></g></svg>`,
    library_emblem: `<svg viewBox="0 0 48 48"><defs><linearGradient id="ia2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e879f9"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs>
        <polygon points="24,3 37,16 31,44 17,44 11,16" fill="url(#ia2)" stroke="#f5d0fe" stroke-width="1.3" stroke-linejoin="round"/>
        <polygon points="24,3 37,16 24,21" fill="#fff" opacity=".35"/><polygon points="24,21 31,44 17,44" fill="#000" opacity=".2"/>
        <path d="M11 16 24 21 37 16" fill="none" stroke="#fff" stroke-width="1" opacity=".55"/></svg>`,
    golden_key: `<svg viewBox="0 0 48 48"><defs><linearGradient id="ia3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="1" stop-color="#d97706"/></linearGradient></defs>
        <g transform="rotate(-35 24 24)"><circle cx="13" cy="24" r="9" fill="none" stroke="url(#ia3)" stroke-width="4.5"/>
        <polygon points="13,17 18,24 13,31 8,24" fill="#7dd3fc" stroke="#e0f2fe" stroke-width="1"/>
        <rect x="21" y="22" width="24" height="4.4" rx="1.6" fill="url(#ia3)"/><rect x="35" y="26" width="4" height="7" fill="url(#ia3)"/><rect x="41" y="26" width="4" height="9" fill="url(#ia3)"/></g></svg>`,
    data_drive: `<svg viewBox="0 0 48 48"><defs><linearGradient id="ia4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#047857"/></linearGradient></defs>
        <rect x="9" y="9" width="30" height="34" rx="4" fill="url(#ia4)" stroke="#a7f3d0" stroke-width="1.3"/>
        <rect x="18" y="3" width="12" height="7" rx="1" fill="#9ca3af" stroke="#e5e7eb" stroke-width=".8"/>
        <rect x="13" y="15" width="22" height="13" rx="2" fill="#022c22" stroke="#34d399" stroke-width="1"/>
        <text x="24" y="25" font-size="9" fill="#6ee7b7" text-anchor="middle" font-family="monospace" font-weight="bold">0101</text>
        <circle cx="34" cy="36" r="2.2" fill="#bbf7d0"/><rect x="13" y="34" width="12" height="3" rx="1" fill="#022c22" opacity=".6"/></svg>`,
    arcade_token: `<svg viewBox="0 0 48 48"><defs><radialGradient id="ia5" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fef08a"/><stop offset="1" stop-color="#d97706"/></radialGradient></defs>
        <circle cx="24" cy="24" r="19" fill="url(#ia5)" stroke="#fef9c3" stroke-width="2"/>
        <circle cx="24" cy="24" r="14" fill="none" stroke="#b45309" stroke-width="1.5" stroke-dasharray="2.5 2.5"/>
        <polygon points="24,14 26.6,21 34,21.3 28.2,26 30.2,33.2 24,29 17.8,33.2 19.8,26 14,21.3 21.4,21" fill="#92400e"/></svg>`
};
const ITEM_COLORS = { keycard_blue: '#38bdf8', library_emblem: '#d946ef', golden_key: '#fbbf24', data_drive: '#34d399', arcade_token: '#facc15' };
let lastAddedItemId = null;

function renderInventoryUI() {
    const slotsContainer = document.getElementById('inventory-slots');
    slotsContainer.innerHTML = '';

    for (let i = 0; i < INV_SLOTS; i++) {
        const item = inventory[i];
        const slot = document.createElement('div');
        if (item) {
            const color = ITEM_COLORS[item.id] || '#38bdf8';
            slot.className = 'inv-slot inv-hex filled';
            slot.style.setProperty('--c', color);
            slot.title = item.name;
            const art = ITEM_ART[item.id];
            const inner = art
                ? `<div class="item-art ${item.id === lastAddedItemId ? 'item-pop' : ''}">${art}</div>`
                : `<i data-lucide="${item.icon}" class="w-5 h-5 ${item.color}"></i>`;
            slot.innerHTML = `<div class="hex-border hex"></div><div class="hex-inner hex">${inner}</div>`;
        } else {
            slot.className = 'inv-slot inv-hex empty';
            slot.innerHTML = '<div class="hex-border hex"></div><div class="hex-inner hex"><span class="hex-empty-mark">?</span></div>';
        }
        slotsContainer.appendChild(slot);
    }
    lastAddedItemId = null;
    safeIcons();
}

function switchRoom(roomId) {
    if (!roomUnlocked[roomId]) {
        showToast(`Room 0${roomId} is locked! Solve the previous room puzzle first.`);
        return;
    }
    loadRoomScene(roomId);
}

let lastResult = null;

function shareScore() {
    if (!lastResult) return;
    const text = `I escaped "${gameName}" in ${lastResult.time} and scored ${lastResult.score} points (${lastResult.rankTitle})! Can you beat me?`;
    const url = location.href;
    if (navigator.share) {
        navigator.share({ title: gameName, text, url }).catch(() => {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(`${text} ${url}`).then(
            () => showToast('Result copied! Paste it anywhere to challenge your friends.'),
            () => showToast('Could not copy automatically. Please copy the page link.')
        );
    } else {
        showToast('Sharing is not supported in this browser. Copy the page link instead.');
    }
}

function triggerVictoryScreen() {
    if (timerInterval) clearInterval(timerInterval);
    const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
    const secs = String(secondsElapsed % 60).padStart(2, '0');
    const bonus = timeBonus();
    const total = playerScore + bonus;
    const rank = getRank(secondsElapsed);
    const isKing = rank.key === 'king';

    document.getElementById('final-time').innerText = `${mins}:${secs}`;
    document.getElementById('final-score').innerText = total;
    document.getElementById('score-breakdown').innerText = `Puzzles & hints ${playerScore} + Speed bonus ${bonus} = ${total}`;
    document.getElementById('victory-rank').innerText = rank.label;
    const titleEl = document.getElementById('victory-title');
    titleEl.innerText = rank.title;
    titleEl.classList.toggle('king-text', isKing);
    titleEl.classList.toggle('text-white', !isKing);
    document.getElementById('victory-card').classList.toggle('king-card', isKing);
    document.getElementById('victory-icon').innerHTML = `<i data-lucide="${isKing ? 'crown' : 'trophy'}" class="w-10 h-10"></i>`;
    safeIcons();
    // Best result (kept in this browser only)
    let best = null;
    try { best = JSON.parse(localStorage.getItem('zd_best') || 'null'); } catch (e) { best = null; }
    const isRecord = !best || total > best.score;
    if (isRecord) {
        try { localStorage.setItem('zd_best', JSON.stringify({ score: total, time: secondsElapsed })); } catch (e) { /* storage unavailable */ }
    }
    const bestEl = document.getElementById('best-line');
    if (bestEl) bestEl.innerText = isRecord ? 'NEW PERSONAL RECORD!' : `Your best: ${best.score} pts`;
    lastResult = { time: `${mins}:${secs}`, score: total, rankTitle: rank.title };

    document.getElementById('victory-message').innerText = isKing
        ? `You escaped in under ${KING_TIME / 60} minutes! You are the KING of "${gameName}" by ${devName}!`
        : `You completed all room puzzles in "${gameName}" developed by ${devName}! Finish under ${KING_TIME / 60} minutes to become the KING.`;

    const victoryModal = document.getElementById('victory-modal');
    victoryModal.classList.remove('opacity-0', 'pointer-events-none');
}

function resetFullGame() {
    secondsElapsed = 0;
    playerScore = 0;
    inventory = [];
    hintsUsedRooms = new Set();
    roomUnlocked = makeRoomUnlocked();
    Object.keys(puzzleData).forEach(k => puzzleData[k].solved = false);

    updateScoreDisplay();
    renderInventoryUI();
    const timerEl = document.getElementById('game-timer');
    if (timerEl) timerEl.innerText = '00:00';
    const kb = document.getElementById('king-badge');
    if (kb) kb.classList.remove('line-through', 'opacity-40');

    const victoryModal = document.getElementById('victory-modal');
    victoryModal.classList.add('opacity-0', 'pointer-events-none');

    switchRoom(1);
    updateHintButton();
    startTimer();
}

function showToast(text) {
    const toast = document.getElementById('toast-notify');
    document.getElementById('toast-text').innerText = text;
    toast.classList.remove('opacity-0');
    setTimeout(() => {
        toast.classList.add('opacity-0');
    }, 3500);
}

function playSuccessSynthSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
}

function playErrorSynthSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.setValueAtTime(160, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
}

// --- TIMER MANAGEMENT ---
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const secs = String(secondsElapsed % 60).padStart(2, '0');
        const timerEl = document.getElementById('game-timer');
        if (timerEl) timerEl.innerText = `${mins}:${secs}`;
        const kb = document.getElementById('king-badge');
        if (kb && secondsElapsed >= KING_TIME) kb.classList.add('line-through', 'opacity-40');
    }, 1000);
}

// --- RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);

    // Animate room props
    const time = Date.now() * 0.002;
    animatedProps.forEach(item => {
        if (item.type === 'spin') item.mesh.rotation.z += 0.02;
        else if (item.type === 'rotate') item.mesh.rotation.y += 0.015;
        else if (item.type === 'float') item.mesh.position.y = 2.2 + Math.sin(time) * 0.1;
        else if (item.type === 'blink') item.mesh.visible = Math.sin(time * item.speed + item.phase) > -0.3;
    });

    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
}

function onWindowResize() {
    if (!camera || !renderer) return;
    const aspect = window.innerWidth / window.innerHeight;
    const d = 7.5;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
