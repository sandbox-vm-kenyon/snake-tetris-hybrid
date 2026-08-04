const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-piece');
const nextContext = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');

context.scale(20, 20);
nextContext.scale(20, 20);

function createMatrix(w, h) {
    const matrix = [];
    for (let y = 0; y < h; y++) {
        matrix[y] = [];
        for (let x = 0; x < w; x++) {
            matrix[y][x] = 0;
        }
    }
    return matrix;
}

function createPiece(type) {
    if (type === 'I') {
        // 4-block straight
        return [
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
        ];
    } else if (type === 'L') {
        // Right-handed L
        return [
            [0, 0, 1],
            [1, 1, 1],
            [0, 0, 0],
        ];
    } else if (type === 'J') {
        // Left-handed J (mirror of L)
        return [
            [1, 0, 0],
            [1, 1, 1],
            [0, 0, 0],
        ];
    } else if (type === 'O') {
        // 4-block square
        return [
            [1, 1],
            [1, 1],
        ];
    } else if (type === 'Z') {
        return [
            [1, 1, 0],
            [0, 1, 1],
            [0, 0, 0],
        ];
    } else if (type === 'S') {
        return [
            [0, 1, 1],
            [1, 1, 0],
            [0, 0, 0],
        ];
    } else if (type === 'T') {
        // 4-block T
        return [
            [0, 1, 0],
            [1, 1, 1],
            [0, 0, 0],
        ];
    }
}

function rotateMatrix(matrix) {
    const N = matrix.length;
    const M = matrix[0].length;
    const res = [];
    for (let i = 0; i < M; i++) {
        res[i] = [];
        for (let j = 0; j < N; j++) {
            res[i][j] = matrix[N - 1 - j][i];
        }
    }
    return res;
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
            if (m[y][x] !== 0 &&
               (o.y + y < 0 || o.x + x < 0 || 
                o.x + x >= arena[0].length || 
                arena[o.y + y] === undefined ||
                arena[o.y + y][o.x + x] !== 0)) {
                return true;
            }
        }
    }
    return false;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[player.pos.y + y][player.pos.x + x] = value;
            }
        });
    });
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = arena.length - 1; y > 0; y--) {
        for (let x = 0; x < arena[y].length; x++) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }
        const row = arena.splice(y, 1)[0];
        arena.unshift(row.fill(0));
        ++rowCount;
    }
    return rowCount;
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    if (player.isFallingSnake) return; // snake-become-piece is not steerable
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

function playerRotate() {
    if (player.isFallingSnake) return; // snake-become-piece is not rotatable
    const oldMatrix = player.matrix;
    player.matrix = rotateMatrix(player.matrix);
    if (collide(arena, player)) {
        player.matrix = oldMatrix;
    }
}

function playerReset() {
    // A new piece is coming in — clear the uncontrollable falling-snake flag so
    // normal steering/rotation applies again to whatever spawns next.
    player.isFallingSnake = false;
    
    if (player.nextPiece === null) {
        player.nextPiece = getRandomPiece();
    }

    if (player.piecesSinceSnake >= player.snakeInterval) {
        spawnSnake();
        player.piecesSinceSnake = 0;
        player.snakeInterval = Math.floor(Math.random() * 3) + 3;
    } else {
        player.matrix = player.nextPiece;
        player.nextPiece = getRandomPiece();
        player.pos.y = 0;
        player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
        player.piecesSinceSnake++;
    }

    if (!player.isSnake && collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        player.score = 0;
        updateScore();
    }
}

function getRandomPiece() {
    const pieces = 'TJSZLOI';
    return createPiece(pieces[Math.floor(Math.random() * pieces.length)]);
}

function spawnSnake() {
    player.isSnake = true;
    // Head points DOWN and leads the descent, so body[0] (the head, where the
    // eyes render) is the LOWEST segment and the tail trails above it.
    player.snake = {
        body: [{x: 5, y: 2}, {x: 5, y: 1}, {x: 5, y: 0}],
        dir: {x: 0, y: 1},
        // Buffered rotation commands. Rapid successive presses are enqueued here
        // and applied at most one-per-movement-tick (see applyQueuedRotation),
        // so two quick turns make the snake actually turn around over successive
        // steps instead of flipping 180 degrees in place into a neck-snap death.
        rotationQueue: []
    };
    player.matrix = [[0]];

    // Randomly spawn 0-3 food items.
    const foodCount = Math.floor(Math.random() * 4);
    player.foods = [];
    for (let i = 0; i < foodCount; i++) {
        let foodPos;
        do {
            foodPos = {
                x: Math.floor(Math.random() * arena[0].length),
                y: Math.floor(Math.random() * arena.length)
            };
            const isOccupied = arena[foodPos.y][foodPos.x] !== 0 || 
                              player.snake.body.some(seg => seg.x === foodPos.x && seg.y === foodPos.y);
            if (!isOccupied) break;
        } while (true);
        player.foods.push(foodPos);
    }
}

function updateSnake() {
    if (!player.isSnake) return;

    // Consume at most one buffered rotation for this movement step, so rapid
    // successive presses turn the snake over successive ticks instead of
    // folding the head 180 degrees onto its neck in a single tick.
    applyQueuedRotation();

    const head = {x: player.snake.body[0].x + player.snake.dir.x, y: player.snake.body[0].y + player.snake.dir.y};

    // Wall, ceiling, or self-collision no longer trigger game-over.
    // Instead, they cause the snake to solidify into a falling piece.
    if (head.x < 0 || head.x >= arena[0].length || head.y < 0) {
        solidifySnake();
        return;
    }

    // Landing on a landed block or the floor is NOT death — it locks the snake
    // in as snake blocks (hybrid rule), so handle that before self-collision.
    if (head.y >= arena.length || (arena[head.y] && arena[head.y][head.x] !== 0)) {
        solidifySnake();
        return;
    }

    // Self-collision no longer triggers game-over; it now solidifies the snake.
    const newBody = [head, ...player.snake.body.slice(0, player.snake.body.length - 1)];
    
    // Check if the head is consuming food.
    if (player.foods) {
        const foodIndex = player.foods.findIndex(f => f.x === head.x && f.y === head.y);
        if (foodIndex !== -1) {
            player.foods.splice(foodIndex, 1);
            // Grow the snake by adding the head and keeping the tail.
            player.snake.body = [head, ...player.snake.body];
            
            // Check for self-collision with the newly grown body.
            for (let i = 1; i < player.snake.body.length; i++) {
                if (head.x === player.snake.body[i].x && head.y === player.snake.body[i].y) {
                    solidifySnake();
                    return;
                }
            }
            return;
        }
    }

    for (let i = 1; i < newBody.length; i++) {
        if (head.x === newBody[i].x && head.y === newBody[i].y) {
            solidifySnake();
            return;
        }
    }

    player.snake.body = newBody;
}

function solidifySnake() {
    // The snake stopping does NOT lock it in place. Instead its body is turned
    // into a normal FALLING Tetris piece so it benefits from the usual gravity:
    // it keeps dropping while there is empty space below and only locks once it
    // actually rests on the floor or a landed block. The player must NOT be able
    // to steer or rotate this piece, so it is flagged uncontrollable.
    const body = player.snake.body;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    body.forEach(seg => {
        minX = Math.min(minX, seg.x); maxX = Math.max(maxX, seg.x);
        minY = Math.min(minY, seg.y); maxY = Math.max(maxY, seg.y);
    });
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const matrix = createMatrix(w, h);
    body.forEach(seg => {
        matrix[seg.y - minY][seg.x - minX] = 1;
    });

    player.isSnake = false;
    player.snake = null;
    player.matrix = matrix;
    player.pos = {x: minX, y: minY};
    player.isFallingSnake = true;
}

function gameOver() {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    updateScore();

    // Fully re-initialize the spawn state for a fresh game. The snake that just
    // hit the wall left isSnake/snake set, so clear them; otherwise the reset
    // piece would still be drawn/treated as a snake. Re-seed the snake counter
    // so the very first piece after the reset is a normal Tetris block and the
    // snake only returns on its usual 3-5-piece interval.
    player.isSnake = false;
    player.isFallingSnake = false;
    player.snake = null;
    player.piecesSinceSnake = 0;
    player.snakeInterval = Math.floor(Math.random() * 3) + 3;

    playerReset();
}

function updateScore() {
    scoreElement.innerText = `Score: ${player.score}`;
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (player.foods) {
        player.foods.forEach(food => {
            context.fillStyle = 'yellow';
            context.fillRect(food.x, food.y, 1, 1);
            context.strokeStyle = 'black';
            context.lineWidth = 0.1;
            context.strokeRect(food.x, food.y, 1, 1);
        });
    }

    drawMatrix(arena, {x: 0, y: 0});
    
    if (player.isSnake) {
        context.fillStyle = 'green';
        player.snake.body.forEach((seg, index) => {
            context.fillRect(seg.x, seg.y, 1, 1);
            context.strokeStyle = 'black';
            context.lineWidth = 0.1;
            context.strokeRect(seg.x, seg.y, 1, 1);
            if (index === 0) {
                context.fillStyle = 'black';
                const eyeSize = 0.15;
                const eyeOffset = 0.2;
                const dir = player.snake.dir;
                
                let x1, y1, x2, y2;
                if (dir.x === 0 && dir.y === 1) {
                    // Moving down: eyes on the bottom (leading) edge.
                    x1 = seg.x + 0.1; y1 = seg.y + 1 - 0.1 - eyeSize;
                    x2 = seg.x + 1 - 0.1 - eyeSize; y2 = seg.y + 1 - 0.1 - eyeSize;
                } else if (dir.x === 0 && dir.y === -1) {
                    // Moving up: eyes on the top (leading) edge.
                    x1 = seg.x + 0.1; y1 = seg.y + 0.1;
                    x2 = seg.x + 1 - 0.1 - eyeSize; y2 = seg.y + 0.1;
                } else if (dir.x === 1 && dir.y === 0) {
                    x1 = seg.x + 1 - 0.1; y1 = seg.y + 0.1;
                    x2 = seg.x + 1 - 0.1; y2 = seg.y + 1 - 0.1 - eyeSize;
                } else if (dir.x === -1 && dir.y === 0) {
                    x1 = seg.x + 0.1; y1 = seg.y + 0.1;
                    x2 = seg.x + 0.1; y2 = seg.y + 1 - 0.1 - eyeSize;
                }
                context.fillRect(x1, y1, eyeSize, eyeSize);
                context.fillRect(x2, y2, eyeSize, eyeSize);
                context.fillStyle = 'green';
            }
        });
    } else {
        drawMatrix(player.matrix, player.pos);
    }

    drawNextPiece();
}

function drawNextPiece() {
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (player.nextPiece) {
        const matrix = player.nextPiece;
        const offsetX = (5 - matrix[0].length / 2) | 0;
        const offsetY = (5 - matrix.length / 2) | 0;
        drawMatrixNext(matrix, {x: offsetX, y: offsetY});
    } else if (player.piecesSinceSnake >= player.snakeInterval) {
        // If the next piece is supposed to be a snake, draw a snake preview
        nextContext.fillStyle = 'green';
        const previewBody = [{x: 2, y: 2}, {x: 2, y: 3}, {x: 2, y: 4}];
        previewBody.forEach(seg => {
            nextContext.fillRect(seg.x, seg.y, 1, 1);
            nextContext.strokeStyle = 'black';
            nextContext.lineWidth = 0.1;
            nextContext.strokeRect(seg.x, seg.y, 1, 1);
        });
    }
}

function drawMatrixNext(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                nextContext.fillStyle = 'red';
                nextContext.fillRect(x + offset.x, y + offset.y, 1, 1);
                nextContext.strokeStyle = 'black';
                nextContext.lineWidth = 0.1;
                nextContext.strokeRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = 'red';
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
                context.strokeStyle = 'black';
                context.lineWidth = 0.1;
                context.strokeRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

const arena = createMatrix(12, 20);

const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    nextPiece: null,
    score: 0,
    piecesSinceSnake: 0,
    snakeInterval: 3,
    isSnake: false,
    isFallingSnake: false,
    food: null
};

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    if (player.isSnake) {
        dropCounter += deltaTime;
        if (dropCounter > 200) {
            updateSnake();
            dropCounter = 0;
        }
    } else {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }
    }

    draw();
    requestAnimationFrame(update);
}

// Heading order: advancing by +1 turns the heading clockwise on screen
// (y grows downward): down -> left -> up -> right -> down. Stepping by +3
// (== -1) turns it counter-clockwise. This keeps rotate-right = clockwise
// and rotate-left = counter-clockwise, matching the button/key names.
const SNAKE_DIRECTIONS = [{x: 0, y: 1}, {x: -1, y: 0}, {x: 0, y: -1}, {x: 1, y: 0}];

function handleSnakeDirectionalInput(keyCode) {
    const dirMap = {
        37: {x: -1, y: 0}, // Left
        38: {x: 0, y: -1}, // Up
        39: {x: 1, y: 0}, // Right
        40: {x: 0, y: 1}, // Down
    };
    const newDir = dirMap[keyCode];
    if (!newDir) return;

    const currentDir = player.snake.dir;
    
    // Map the requested direction to a rotation step
    const currentIdx = SNAKE_DIRECTIONS.findIndex(d => d.x === currentDir.x && d.y === currentDir.y);
    const newIdx = SNAKE_DIRECTIONS.findIndex(d => d.x === newDir.x && d.y === newDir.y);
    
    if (currentIdx === -1 || newIdx === -1) return;

    let step = newIdx - currentIdx;
    if (step < 0) step += 4;

    if (step === 0) return; // Ignore if same direction

    rotateSnake(step);
}


// Enqueue a 90-degree turn command for the snake. `step` is +1 for clockwise
// (right) and +3 (i.e. -1) for counter-clockwise (left). Rather than steering
// the head immediately, the command is buffered and applied one-per-movement-
// tick by applyQueuedRotation. Traditional snake games buffer inputs this way:
// two very quick presses no longer collapse into a single-tick 180 flip (which
// caused an instant self-reversal death); instead each press turns the head 90
// degrees on a successive step, so the snake advances a cell and genuinely
// turns around. The queue is capped so mashing can't build up a long backlog.
function rotateSnake(step) {
    if (!player.isSnake || !player.snake) return;
    if (player.snake.rotationQueue.length < 3) {
        player.snake.rotationQueue.push(step);
    }
}

// Apply at most ONE buffered turn, called once per snake movement tick. A turn
// that would flip the head a full 180 degrees directly opposite its current
// facing is rejected (dropped from the queue) rather than causing an instant
// neck-snap death — so the player can mash rotate without a false game-over.
function applyQueuedRotation() {
    if (player.snake.rotationQueue.length === 0) return;
    const step = player.snake.rotationQueue.shift();
    const dir = player.snake.dir;
    const idx = SNAKE_DIRECTIONS.findIndex(d => d.x === dir.x && d.y === dir.y);
    const next = SNAKE_DIRECTIONS[(idx + step) % SNAKE_DIRECTIONS.length];
    if (next.x === -dir.x && next.y === -dir.y) {
        return; // reject a direct reversal (relative to the current facing)
    }
    player.snake.dir = next;
}

document.getElementById('up').addEventListener('click', () => {
    if (player.isSnake) {
        handleSnakeDirectionalInput(38);
    }
});

document.getElementById('rotate-right').addEventListener('click', () => {
    if (player.isSnake) {
        rotateSnake(1);
    } else {
        playerRotate();
    }
});

document.getElementById('rotate-left').addEventListener('click', () => {
    if (player.isSnake) {
        rotateSnake(3);
    } else {
        playerRotate();
    }
});

document.getElementById('left').addEventListener('click', () => {
    if (player.isSnake) {
        handleSnakeDirectionalInput(37);
    } else if (!player.isSnake) {
        playerMove(-1);
    }
});

document.getElementById('right').addEventListener('click', () => {
    if (player.isSnake) {
        handleSnakeDirectionalInput(39);
    } else if (!player.isSnake) {
        playerMove(1);
    }
});

let downButtonTimer = null;

function startDownRepeat() {
    if (player.isSnake) {
        handleSnakeDirectionalInput(40);
    } else if (!player.isSnake && !player.isFallingSnake) {
        playerDrop();
    }
    
    // Set up the repeat interval
    downButtonTimer = setInterval(() => {
        if (player.isSnake) {
            handleSnakeDirectionalInput(40);
        } else if (!player.isSnake && !player.isFallingSnake) {
            playerDrop();
        }
    }, 150); // Repeat every 150ms
}

function stopDownRepeat() {
    if (downButtonTimer) {
        clearInterval(downButtonTimer);
        downButtonTimer = null;
    }
}

document.getElementById('down').addEventListener('mousedown', (e) => {
    e.preventDefault();
    startDownRepeat();
});

document.getElementById('down').addEventListener('mouseup', stopDownRepeat);
document.getElementById('down').addEventListener('mouseleave', stopDownRepeat);

// Also support touch events for mobile
document.getElementById('down').addEventListener('touchstart', (e) => {
    e.preventDefault();
    startDownRepeat();
});

document.getElementById('down').addEventListener('touchend', stopDownRepeat);

document.addEventListener('keydown', event => {
    if (event.keyCode === 37) { // Left
        if (player.isSnake) {
            handleSnakeDirectionalInput(event.keyCode);
        } else {
            playerMove(-1);
        }
    } else if (event.keyCode === 39) { // Right
        if (player.isSnake) {
            handleSnakeDirectionalInput(event.keyCode);
        } else {
            playerMove(1);
        }
    } else if (event.keyCode === 40) { // Down
        if (player.isSnake) {
            handleSnakeDirectionalInput(event.keyCode);
        } else if (!player.isFallingSnake) {
            playerDrop();
        }
    } else if (event.keyCode === 38) { // Up
        if (player.isSnake) {
            handleSnakeDirectionalInput(event.keyCode);
        }
    } else if (event.key === 'd' || event.key === 'D') {
        if (player.isSnake) {
            rotateSnake(3);
        } else {
            playerRotate();
        }
    } else if (event.key === 'f' || event.key === 'F') {
        if (player.isSnake) {
            rotateSnake(1);
        } else {
            playerRotate();
        }
    }
});

playerReset();
updateScore();
update();
