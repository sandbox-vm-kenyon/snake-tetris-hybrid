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
        return [
            [0, 1, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 0, 0],
        ];
    } else if (type === 'L') {
        return [
            [0, 0, 1],
            [0, 0, 1],
            [1, 1, 1],
        ];
    } else if (type === 'J') {
        return [
            [1, 0, 0],
            [1, 0, 0],
            [1, 1, 1],
        ];
    } else if (type === 'O') {
        return [
            [1, 1],
            [1, 1],
        ];
    } else if (type === 'Z') {
        return [
            [1, 1, 0],
            [0, 1, 0],
            [0, 1, 1],
        ];
    } else if (type === 'S') {
        return [
            [0, 1, 1],
            [0, 1, 0],
            [1, 1, 0],
        ];
    } else if (type === 'T') {
        return [
            [0, 1, 0],
            [1, 1, 1],
            [0, 1, 0],
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
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

function playerRotate() {
    const oldMatrix = player.matrix;
    player.matrix = rotateMatrix(player.matrix);
    if (collide(arena, player)) {
        player.matrix = oldMatrix;
    }
}

function playerReset() {
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
    player.snake = {
        body: [{x: 5, y: 0}, {x: 5, y: 1}, {x: 5, y: 2}],
        dir: {x: 0, y: 1}
    };
    player.matrix = [[0]]; 
}

function updateSnake() {
    if (!player.isSnake) return;

    const head = {x: player.snake.body[0].x + player.snake.dir.x, y: player.snake.body[0].y + player.snake.dir.y};

    if (head.x < 0 || head.x >= arena[0].length || head.y < 0) {
        gameOver();
        return;
    }

    if (head.y >= arena.length || (arena[head.y] && arena[head.y][head.x] !== 0)) {
        solidifySnake();
        return;
    }

    player.snake.body.unshift(head);
    player.snake.body.pop();
}

function solidifySnake() {
    player.isSnake = false;
    player.snake.body.forEach(seg => {
        if (seg.y >= 0 && seg.y < arena.length && seg.x >= 0 && seg.x < arena[0].length) {
            arena[seg.y][seg.x] = 1;
        }
    });
    playerReset();
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
        player.snake.body.forEach(seg => {
            context.fillRect(seg.x, seg.y, 1, 1);
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
    isSnake: false
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

document.getElementById('rotate-right').addEventListener('click', () => {
    if (player.isSnake) {
        const directions = [{x: 0, y: 1}, {x: 1, y: 0}, {x: 0, y: -1}, {x: -1, y: 0}];
        const idx = directions.findIndex(d => d.x === player.snake.dir.x && d.y === player.snake.dir.y);
        player.snake.dir = directions[(idx + 1) % directions.length];
    } else {
        playerRotate();
    }
});

document.getElementById('rotate-left').addEventListener('click', () => {
    if (player.isSnake) {
        const directions = [{x: 0, y: 1}, {x: 1, y: 0}, {x: 0, y: -1}, {x: -1, y: 0}];
        const idx = directions.findIndex(d => d.x === player.snake.dir.x && d.y === player.snake.dir.y);
        player.snake.dir = directions[(idx + 3) % directions.length];
    } else {
        playerRotate();
    }
});

document.getElementById('up').addEventListener('click', () => {
    if (player.isSnake) {
        const directions = [{x: 0, y: 1}, {x: 1, y: 0}, {x: 0, y: -1}, {x: -1, y: 0}];
        const idx = directions.findIndex(d => d.x === player.snake.dir.x && d.y === player.snake.dir.y);
        player.snake.dir = directions[(idx + 2) % directions.length];
    }
});

document.getElementById('left').addEventListener('click', () => {
    if (player.isSnake) {
        const directions = [{x: 0, y: 1}, {x: 1, y: 0}, {x: 0, y: -1}, {x: -1, y: 0}];
        const idx = directions.findIndex(d => d.x === player.snake.dir.x && d.y === player.snake.dir.y);
        player.snake.dir = directions[(idx + 3) % directions.length];
    } else {
        playerMove(-1);
    }
});

document.getElementById('right').addEventListener('click', () => {
    if (player.isSnake) {
        const directions = [{x: 0, y: 1}, {x: 1, y: 0}, {x: 0, y: -1}, {x: -1, y: 0}];
        const idx = directions.findIndex(d => d.x === player.snake.dir.x && d.y === player.snake.dir.y);
        player.snake.dir = directions[(idx + 1) % directions.length];
    } else {
        playerMove(1);
    }
});

document.getElementById('down').addEventListener('click', () => {
    if (player.isSnake) {
        const directions = [{x: 0, y: 1}, {x: 1, y: 0}, {x: 0, y: -1}, {x: -1, y: 0}];
        const idx = directions.findIndex(d => d.x === player.snake.dir.x && d.y === player.snake.dir.y);
        player.snake.dir = directions[(idx + 1) % directions.length];
    } else if (!player.isSnake) {
        playerDrop();
    }
});

playerReset();
updateScore();
update();
