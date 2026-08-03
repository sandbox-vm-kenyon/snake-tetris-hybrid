const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

context.scale(20, 20);

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
    if (player.piecesSinceSnake >= player.snakeInterval) {
        spawnSnake();
        player.piecesSinceSnake = 0;
        player.snakeInterval = Math.floor(Math.random() * 3) + 3;
    } else {
        const pieces = 'TJSZLI';
        player.matrix = createPiece(pieces[Math.floor(Math.random() * pieces.length)]);
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

function spawnSnake() {
    player.isSnake = true;
    // Head points DOWN and leads the descent, so body[0] (the head, where the
    // eyes render) is the LOWEST segment and the tail trails above it.
    player.snake = {
        body: [{x: 5, y: 2}, {x: 5, y: 1}, {x: 5, y: 0}],
        dir: {x: 0, y: 1}
    };
    player.matrix = [[0]];
}

function updateSnake() {
    if (!player.isSnake) return;

    const head = {x: player.snake.body[0].x + player.snake.dir.x, y: player.snake.body[0].y + player.snake.dir.y};

    // Death ONLY on the three fatal conditions: side walls or the ceiling.
    if (head.x < 0 || head.x >= arena[0].length || head.y < 0) {
        gameOver();
        return;
    }

    // Landing on a landed block or the floor is NOT death — it locks the snake
    // in as snake blocks (hybrid rule), so handle that before self-collision.
    if (head.y >= arena.length || (arena[head.y] && arena[head.y][head.x] !== 0)) {
        solidifySnake();
        return;
    }

    // Self-collision death is checked against the body the snake will actually
    // occupy after the move (tail vacated). The immediate neck segment the head
    // is leaving is excluded, so reversing/rotating the head direction multiple
    // times in a row never triggers a false game-over.
    const newBody = [head, ...player.snake.body.slice(0, player.snake.body.length - 1)];
    for (let i = 1; i < newBody.length; i++) {
        if (head.x === newBody[i].x && head.y === newBody[i].y) {
            gameOver();
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
    playerReset();
}

function updateScore() {
    scoreElement.innerText = `Score: ${player.score}`;
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawMatrix(arena, {x: 0, y: 0});
    
    if (player.isSnake) {
        context.fillStyle = 'green';
        player.snake.body.forEach((seg, index) => {
            context.fillRect(seg.x, seg.y, 1, 1);
            if (index === 0) {
                context.fillStyle = 'black';
                const eyeSize = 0.15;
                const eyeOffset = 0.2;
                const dir = player.snake.dir;
                
                let x1, y1, x2, y2;
                if (dir.x === 0 && dir.y === 1) {
                    // Moving down: eyes on the bottom (leading) edge.
                    x1 = seg.x + eyeOffset; y1 = seg.y + 1 - eyeOffset;
                    x2 = seg.x + 1 - eyeOffset; y2 = seg.y + 1 - eyeOffset;
                } else if (dir.x === 0 && dir.y === -1) {
                    // Moving up: eyes on the top (leading) edge.
                    x1 = seg.x + eyeOffset; y1 = seg.y + eyeOffset;
                    x2 = seg.x + 1 - eyeOffset; y2 = seg.y + eyeOffset;
                } else if (dir.x === 1 && dir.y === 0) {
                    x1 = seg.x + 1 - eyeOffset; y1 = seg.y + eyeOffset;
                    x2 = seg.x + 1 - eyeOffset; y2 = seg.y + 1 - eyeOffset;
                } else if (dir.x === -1 && dir.y === 0) {
                    x1 = seg.x + eyeOffset; y1 = seg.y + eyeOffset;
                    x2 = seg.x + eyeOffset; y2 = seg.y + 1 - eyeOffset;
                }
                context.fillRect(x1, y1, eyeSize, eyeSize);
                context.fillRect(x2, y2, eyeSize, eyeSize);
                context.fillStyle = 'green';
            }
        });
    } else {
        drawMatrix(player.matrix, player.pos);
    }
}

function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = 'red';
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

const arena = createMatrix(12, 20);

const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    score: 0,
    piecesSinceSnake: 0,
    snakeInterval: 3,
    isSnake: false,
    isFallingSnake: false
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

// Turn the snake's heading by 90 degrees. `step` is +1 for clockwise (right)
// and +3 (i.e. -1) for counter-clockwise (left). A turn that would flip the
// head a full 180 degrees into its own neck is rejected — that lets the player
// rotate repeatedly without ever triggering a false self-collision game-over.
function rotateSnake(step) {
    // Ordered so that advancing by +1 turns the heading clockwise on screen
    // (y grows downward): down -> left -> up -> right -> down. Stepping by +3
    // (== -1) turns it counter-clockwise. This keeps rotate-right = clockwise
    // and rotate-left = counter-clockwise, matching the button/key names.
    const directions = [{x: 0, y: 1}, {x: -1, y: 0}, {x: 0, y: -1}, {x: 1, y: 0}];
    const idx = directions.findIndex(d => d.x === player.snake.dir.x && d.y === player.snake.dir.y);
    const next = directions[(idx + step) % directions.length];
    if (next.x === -player.snake.dir.x && next.y === -player.snake.dir.y) {
        return; // ignore a direct reversal
    }
    player.snake.dir = next;
}

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
    if (!player.isSnake) {
        playerMove(-1);
    }
});

document.getElementById('right').addEventListener('click', () => {
    if (!player.isSnake) {
        playerMove(1);
    }
});

document.getElementById('down').addEventListener('click', () => {
    // Not while a snake is being steered, and not for the uncontrollable
    // snake-become-falling-piece (the player must not control its descent).
    if (!player.isSnake && !player.isFallingSnake) {
        playerDrop();
    }
});

document.addEventListener('keydown', event => {
    if (event.keyCode === 37) { // Left
        document.getElementById('left').click();
    } else if (event.keyCode === 39) { // Right
        document.getElementById('right').click();
    } else if (event.keyCode === 40) { // Down
        document.getElementById('down').click();
    } else if (event.key === 'd' || event.key === 'D') {
        document.getElementById('rotate-left').click();
    } else if (event.key === 'f' || event.key === 'F') {
        document.getElementById('rotate-right').click();
    }
});

playerReset();
updateScore();
update();
