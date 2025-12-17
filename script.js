const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('final-score');
const gameOverScreen = document.getElementById('game-over');
const startScreen = document.getElementById('start-screen');
const charSelectScreen = document.getElementById('character-select');

// Buttons
const startBtn = document.getElementById('start-btn');
const charsBtn = document.getElementById('chars-btn');
const backBtn = document.getElementById('back-btn');
const restartBtn = document.getElementById('restart-btn');
const charBtns = document.querySelectorAll('.char-btn');

// Game Constants
const GRID_SIZE = 40;
const COLS = canvas.width / GRID_SIZE;
const ROWS = canvas.height / GRID_SIZE;
const SCROLL_THRESHOLD = 8 * GRID_SIZE;

// Colors Palette
const COLORS = {
    grass: '#7cfc00',
    grassDark: '#5bb800',
    road: '#555',
    roadDark: '#444',
    treeTrunk: '#8b4513',
    treeLeaves: '#228b22',

    // Character Colors
    pig: { body: '#ffb6c1', dark: '#e08ba3', detail: '#ff69b4', eye: '#000' },
    chicken: { body: '#ffffff', dark: '#dddddd', detail: '#ff0000', eye: '#000' },
    duck: { body: '#ffeb3b', dark: '#fdd835', detail: '#ff9800', eye: '#000' },
    cow: { body: '#eeeeee', dark: '#bdbdbd', detail: '#222222', eye: '#000' }
};

// Game State
let gameState = {
    mode: 'MENU', // MENU, PLAYING, GAMEOVER
    score: 0,
    player: null,
    lanes: [],
    frameCount: 0,
    selectedChar: 'pig'
};

// --- VOXEL RENDERING ENGINE ---
function shadeColor(color, percent) {
    let f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent, R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}

function drawCube(x, y, w, h, d, color) {
    const depthScale = 0.6;
    const renderD = d * depthScale;

    // Top Face (Lightest)
    ctx.fillStyle = shadeColor(color, 0.2);
    ctx.fillRect(x, y - renderD, w, renderD);

    // Front Face (Normal)
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);

    // Right Side Face (Darkest)
    const depthX = d * 0.4;
    const depthY = d * 0.4;

    ctx.fillStyle = shadeColor(color, -0.2);
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w + depthX, y - depthY);
    ctx.lineTo(x + w + depthX, y + h - depthY);
    ctx.lineTo(x + w, y + h);
    ctx.fill();

    // Top Extension (Connection)
    ctx.fillStyle = shadeColor(color, 0.2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + depthX, y - depthY);
    ctx.lineTo(x + w + depthX, y - depthY);
    ctx.lineTo(x + w, y);
    ctx.fill();

    // Redraw Front to fix overlapping lines
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}


// --- GAME CLASSES ---

class Player {
    constructor(type) {
        this.x = Math.floor(COLS / 2) * GRID_SIZE;
        this.y = (ROWS - 2) * GRID_SIZE;
        this.width = GRID_SIZE - 10;
        this.height = GRID_SIZE - 10;
        this.offsetY = 0;
        this.type = type;
        this.facing = 'down'; // up, down, left, right
    }

    getRenderY() {
        return this.y + this.height;
    }

    draw() {
        const cx = this.x + 5;
        const cy = this.y + 5 + this.offsetY;
        const pal = COLORS[this.type];

        // Legs
        const legW = 6, legH = 8;
        const legCol = this.type === 'chicken' || this.type === 'duck' ? '#ff9800' : pal.dark;

        // Animate legs based on move? Just static for now
        drawCube(cx + 4, cy + 22, legW, legH, 4, legCol);
        drawCube(cx + 20, cy + 22, legW, legH, 4, legCol);

        // Body Size varies slightly
        let bodyW = 32, bodyH = 24, bodyD = 20;

        // Draw Body based on Facing
        drawCube(cx, cy, bodyW, bodyH, bodyD, pal.body);

        // Details (Eyes, Beak, Snout)
        // Adjust positions based on facing
        const eyeColor = pal.eye;
        const detailColor = pal.detail;

        if (this.facing === 'down') { // Front View
            // Eyes
            ctx.fillStyle = '#fff';
            ctx.fillRect(cx + 4, cy + 6, 8, 5);
            ctx.fillRect(cx + 20, cy + 6, 8, 5);
            ctx.fillStyle = eyeColor;

            // Pupils (look at player)
            if (this.type === 'cow') { // Derpy cow eyes
                ctx.fillRect(cx + 4, cy + 7, 3, 3);
                ctx.fillRect(cx + 25, cy + 7, 3, 3);
            } else {
                ctx.fillRect(cx + 6, cy + 7, 4, 4);
                ctx.fillRect(cx + 22, cy + 7, 4, 4);
            }

            // Snout/Beak
            if (this.type === 'pig') {
                ctx.fillStyle = detailColor;
                ctx.fillRect(cx + 10, cy + 14, 12, 6);
                ctx.fillStyle = '#b04060'; // Nostrils
                ctx.fillRect(cx + 12, cy + 16, 3, 3);
                ctx.fillRect(cx + 17, cy + 16, 3, 3);
            } else if (this.type === 'chicken') {
                ctx.fillStyle = '#ff0000'; // Wattles
                ctx.fillRect(cx + 14, cy + 16, 4, 6);
                ctx.fillStyle = '#ff9800'; // Beak
                ctx.fillRect(cx + 12, cy + 12, 8, 5);
            } else if (this.type === 'duck') {
                ctx.fillStyle = detailColor; // Orange bill
                ctx.fillRect(cx + 10, cy + 14, 12, 5);
            } else if (this.type === 'cow') {
                ctx.fillStyle = detailColor; // Black snout
                ctx.fillRect(cx + 8, cy + 16, 16, 6);
                // Horns
                drawCube(cx - 2, cy - 4, 6, 8, 4, '#ddd');
                drawCube(cx + 28, cy - 4, 6, 8, 4, '#ddd');
            }
        } else if (this.facing === 'left') { // Side View
            // One Eye
            ctx.fillStyle = '#fff';
            ctx.fillRect(cx + 8, cy + 6, 8, 5);
            ctx.fillStyle = eyeColor;
            ctx.fillRect(cx + 8, cy + 7, 4, 4);

            // Snout Profile
            if (this.type === 'duck' || this.type === 'chicken') {
                ctx.fillStyle = '#ff9800';
                ctx.fillRect(cx, cy + 14, 6, 4); // Beak sticking out left
            }
        } else if (this.facing === 'right') { // Side View
            // One Eye
            ctx.fillStyle = '#fff';
            ctx.fillRect(cx + 16, cy + 6, 8, 5);
            ctx.fillStyle = eyeColor;
            ctx.fillRect(cx + 20, cy + 7, 4, 4);

            // Snout Profile
            if (this.type === 'duck' || this.type === 'chicken') {
                ctx.fillStyle = '#ff9800';
                ctx.fillRect(cx + 28, cy + 14, 6, 4); // Beak stick out right
            }
        } else { // Up (Back View)
            // Tails
            if (this.type === 'pig') {
                ctx.fillStyle = detailColor;
                ctx.fillRect(cx + 14, cy + 18, 4, 4); // Curly tail placeholder
            }
        }

        // Generic Top detail (Chicken Comb)
        if (this.type === 'chicken') {
            ctx.fillStyle = '#ff0000';
            // Simple Comb
            ctx.fillRect(cx + 12, cy - 6, 8, 6);
        }
    }

    move(dx, dy) {
        if (gameState.mode !== 'PLAYING') return;

        // Set Facing
        if (dx < 0) this.facing = 'left';
        if (dx > 0) this.facing = 'right';
        if (dy < 0) this.facing = 'up';
        if (dy > 0) this.facing = 'down';

        const newX = this.x + dx * GRID_SIZE;
        const newY = this.y + dy * GRID_SIZE;

        // Boundary + Obstacle Check
        if (newX >= 0 && newX < canvas.width) {

            // Check Collision with Trees (Solid Walls)
            // Find which lane targetY belongs to
            // Since lanes move, their Y changes. We need to find the Lane object that has this Y.
            // Lane.y matches the drawing Y.
            const targetLane = gameState.lanes.find(l => Math.abs(l.y - newY) < 5); // Approx check
            let blocked = false;

            if (targetLane) {
                for (let obs of targetLane.obstacles) {
                    if (Math.abs(obs.x - newX) < 10) { // Same Column
                        blocked = true;
                        break;
                    }
                }
            }

            if (!blocked) {
                this.x = newX; // Commit X move
            }
        }

        // Y Movement Logic
        // For Y, we also need to check obstacles if moving vertically
        // BUT logic loop handles X/Y separate updates usually? 
        // Here we do one step.
        // Let's re-verify the "blocked" logic for Y.

        const targetLaneY = gameState.lanes.find(l => Math.abs(l.y - newY) < 5);
        let blockedY = false;
        if (targetLaneY) {
            for (let obs of targetLaneY.obstacles) {
                if (Math.abs(obs.x - this.x) < 10) { // Same X (committed above)
                    blockedY = true;
                    break;
                }
            }
        }

        if (!blockedY) {
            if (dy < 0) { // Moving Up (Forward)
                gameState.currentDistance++;
                if (gameState.currentDistance > gameState.score) {
                    gameState.score = gameState.currentDistance;
                    scoreElement.textContent = gameState.score;
                }

                if (newY < SCROLL_THRESHOLD) {
                    scrollWorld();
                    // Score logic handles globally above
                } else {
                    if (newY >= 0) {
                        this.y = newY;
                    }
                }
            } else if (dy > 0) { // Moving Down (Backward)
                if (newY < canvas.height) {
                    this.y = newY;
                    gameState.currentDistance = Math.max(0, gameState.currentDistance - 1);
                }
            }
        }
    }
}

class Car {
    constructor(x, y, width, speed, direction, type) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = GRID_SIZE - 10;
        this.speed = speed;
        this.direction = direction;
        this.type = type;
        this.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
    }

    getRenderY() {
        return this.y + this.height;
    }

    update() {
        this.x += this.speed * this.direction;
    }

    draw() {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(this.x + 5, this.y + 25, this.width - 10, 10);
        drawCube(this.x, this.y + 5, this.width, 20, 20, this.color);
        const cabinW = this.width * 0.6;
        const cabinX = this.x + (this.width - cabinW) / 2;
        drawCube(cabinX, this.y - 10, cabinW, 15, 15, shadeColor(this.color, 0.4));
        ctx.fillStyle = '#222';
        ctx.fillRect(this.x + 5, this.y + 20, 8, 8);
        ctx.fillRect(this.x + this.width - 13, this.y + 20, 8, 8);
    }

    isOffScreen() {
        return (this.direction > 0 && this.x > canvas.width + 100) ||
            (this.direction < 0 && this.x + this.width < -100);
    }
}

class Tree {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = GRID_SIZE;
        this.height = GRID_SIZE;
    }

    getRenderY() {
        return this.y + this.height;
    }

    draw() {
        drawCube(this.x + 12, this.y + 10, 16, 30, 16, COLORS.treeTrunk);
        drawCube(this.x, this.y - 20, 40, 30, 30, COLORS.treeLeaves);
        drawCube(this.x + 5, this.y - 45, 30, 25, 25, shadeColor(COLORS.treeLeaves, 0.1));
    }
}

class Lane {
    constructor(yIndex) {
        this.y = yIndex * GRID_SIZE;
        this.cars = [];
        this.obstacles = [];

        let speedMultiplier = 1 + (gameState.score * 0.02);
        speedMultiplier = Math.min(speedMultiplier, 3.5);

        this.speed = (Math.random() * 2 + 2) * speedMultiplier;
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.type = Math.random() > 0.4 ? 'road' : 'safe';

        if (yIndex === ROWS - 1 || yIndex === ROWS - 2) this.type = 'safe';

        if (this.type === 'safe' && Math.random() > 0.3) {
            const numTrees = Math.floor(Math.random() * 3);
            for (let i = 0; i < numTrees; i++) {
                const tx = Math.floor(Math.random() * COLS) * GRID_SIZE;
                this.obstacles.push(new Tree(tx, this.y));
            }
        }
    }

    update() {
        this.y += 0;
        this.obstacles.forEach(o => o.y = this.y);

        if (this.type === 'road') {
            if (Math.random() < 0.02) {
                let validSpawn = true;
                for (let car of this.cars) {
                    if (this.direction === 1 && car.x < GRID_SIZE * 2) validSpawn = false;
                    if (this.direction === -1 && car.x > canvas.width - GRID_SIZE * 2) validSpawn = false;
                }

                if (validSpawn) {
                    const width = GRID_SIZE * (Math.random() > 0.7 ? 2.5 : 1.5);
                    const carX = this.direction === 1 ? -width : canvas.width;
                    this.cars.push(new Car(carX, this.y, width, this.speed, this.direction));
                }
            }

            this.cars.forEach(car => car.update());
            this.cars = this.cars.filter(car => !car.isOffScreen());
        }
    }

    drawGround() {
        if (this.type === 'road') {
            ctx.fillStyle = COLORS.road;
            ctx.fillRect(0, this.y, canvas.width, GRID_SIZE);
            ctx.fillStyle = COLORS.roadDark;
            ctx.fillRect(0, this.y + GRID_SIZE - 5, canvas.width, 5);
        } else {
            ctx.fillStyle = COLORS.grass;
            ctx.fillRect(0, this.y, canvas.width, GRID_SIZE);
            ctx.fillStyle = COLORS.grassDark;
            ctx.fillRect(0, this.y + GRID_SIZE - 5, canvas.width, 5);
        }
    }

    checkCollision(player) {
        if (player.y < this.y + GRID_SIZE - 5 && player.y + player.height > this.y + 5) {
            for (let car of this.cars) {
                if (player.x + 5 < car.x + car.width - 5 &&
                    player.x + player.width - 5 > car.x + 5) {
                    return true;
                }
            }
        }
        return false;
    }
}

function scrollWorld() {
    gameState.lanes.forEach(lane => {
        lane.y += GRID_SIZE;
        lane.cars.forEach(c => c.y += GRID_SIZE);
        lane.obstacles.forEach(o => o.y += GRID_SIZE);
    });

    gameState.lanes = gameState.lanes.filter(lane => lane.y < canvas.height);
    const newLane = new Lane(0);
    gameState.lanes.unshift(newLane);
}

// Input Handling
const keysHeld = {};

document.addEventListener('keydown', (e) => {
    if (gameState.mode !== 'PLAYING') return;

    const key = e.key.toLowerCase();

    // Prevent default scrolling for arrow keys
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
    }

    // Only move if key is not currently held down
    if (!keysHeld[key]) {
        keysHeld[key] = true;

        const action = {
            'w': () => gameState.player.move(0, -1),
            's': () => gameState.player.move(0, 1),
            'a': () => gameState.player.move(-1, 0),
            'd': () => gameState.player.move(1, 0),
            'arrowup': () => gameState.player.move(0, -1),
            'arrowdown': () => gameState.player.move(0, 1),
            'arrowleft': () => gameState.player.move(-1, 0),
            'arrowright': () => gameState.player.move(1, 0)
        }[key];

        if (action) action();
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    keysHeld[key] = false;
});

// UI Event Functions
function showStartScreen() {
    gameState.mode = 'MENU';
    startScreen.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');
    charSelectScreen.classList.add('hidden');
    // Draw background game for ambiance
    initGameEntities();
    loop();
}

function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    charSelectScreen.classList.add('hidden');

    initGameEntities();
    gameState.mode = 'PLAYING';
}

function showCharSelect() {
    startScreen.classList.add('hidden');
    charSelectScreen.classList.remove('hidden');
}

function selectChar(e) {
    const type = e.target.getAttribute('data-type');
    if (type) {
        gameState.selectedChar = type;
        // Visual feedback
        charBtns.forEach(btn => {
            btn.classList.remove('selected');
            if (btn.getAttribute('data-type') === type) btn.classList.add('selected');
        });
    }
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
charsBtn.addEventListener('click', showCharSelect);
backBtn.addEventListener('click', () => {
    charSelectScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

charBtns.forEach(btn => btn.addEventListener('click', selectChar));


function gameOver() {
    gameState.mode = 'GAMEOVER';
    finalScoreElement.textContent = gameState.score;
    gameOverScreen.classList.remove('hidden');
}

function update() {
    if (gameState.mode === 'GAMEOVER') return;
    // In MENU mode, we can still act out the background traffic

    gameState.frameCount++;
    gameState.lanes.forEach(lane => lane.update());

    if (gameState.mode === 'PLAYING') {
        // Check Collisions
        for (let lane of gameState.lanes) {
            if (lane.checkCollision(gameState.player)) {
                gameOver();
                break;
            }
        }
    }
}

function draw() {
    gameState.lanes.forEach(lane => lane.drawGround());

    let renderList = [];
    if (gameState.mode === 'PLAYING' || gameState.mode === 'MENU') { // Draw player in menu? Maybe not.
        if (gameState.player) renderList.push(gameState.player);
    }

    gameState.lanes.forEach(lane => {
        lane.cars.forEach(car => renderList.push(car));
        lane.obstacles.forEach(obs => renderList.push(obs));
    });

    renderList.sort((a, b) => a.getRenderY() - b.getRenderY());
    renderList.forEach(obj => obj.draw());
}

function loop() {
    update();
    draw();
    if (true) { // Always loop for background effects
        requestAnimationFrame(loop);
    }
}

function initGameEntities() {
    gameState.score = 0;
    gameState.currentDistance = 0;
    gameState.frameCount = 0;
    scoreElement.textContent = 0;

    gameState.lanes = [];
    for (let i = 0; i < ROWS; i++) {
        gameState.lanes.push(new Lane(i)); // Fill screen
    }

    gameState.player = new Player(gameState.selectedChar);
}

// Initialize
showStartScreen();
