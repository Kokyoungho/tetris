const COLS = 10;
const ROWS = 20;
const PREVIEW_SIZE = 4;

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

const PIECE_TYPES = Object.keys(SHAPES);

const boardElement = document.querySelector("#game-board");
const nextBoardElement = document.querySelector("#next-board");
const modeBadge = document.querySelector("#mode-badge");
const statusDot = document.querySelector(".status-dot");
const liveCopy = document.querySelector("#live-copy");
const overlay = document.querySelector("#board-overlay");
const overlayKicker = document.querySelector("#overlay-kicker");
const overlayTitle = document.querySelector("#overlay-title");
const overlayDescription = document.querySelector("#overlay-description");
const overlayAction = document.querySelector("#overlay-action");
const primaryAction = document.querySelector("#primary-action");
const pauseButton = document.querySelector("#pause-button");
const scoreValue = document.querySelector("#score-value");
const linesValue = document.querySelector("#lines-value");
const levelValue = document.querySelector("#level-value");

let board = createEmptyBoard();
let currentPiece = null;
let nextType = null;
let bag = [];
let score = 0;
let lines = 0;
let level = 1;
let gameState = "ready";
let animationFrame = null;
let lastDropTime = 0;

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function shuffledBag() {
  const nextBag = [...PIECE_TYPES];
  for (let index = nextBag.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextBag[index], nextBag[randomIndex]] = [nextBag[randomIndex], nextBag[index]];
  }
  return nextBag;
}

function drawType() {
  if (bag.length === 0) bag = shuffledBag();
  return bag.pop();
}

function createPiece(type) {
  const matrix = cloneMatrix(SHAPES[type]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0,
  };
}

function createBoardCells() {
  boardElement.innerHTML = "";
  for (let index = 0; index < COLS * ROWS; index += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    boardElement.appendChild(cell);
  }
}

function createPreviewCells() {
  nextBoardElement.innerHTML = "";
  for (let index = 0; index < PREVIEW_SIZE * PREVIEW_SIZE; index += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    nextBoardElement.appendChild(cell);
  }
}

function isOccupied(x, y, matrix = currentPiece?.matrix) {
  if (!matrix) return false;
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix[row].length; column += 1) {
      if (!matrix[row][column]) continue;
      const boardX = x + column;
      const boardY = y + row;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

function movePiece(deltaX, deltaY) {
  if (!currentPiece || isOccupied(currentPiece.x + deltaX, currentPiece.y + deltaY)) return false;
  currentPiece.x += deltaX;
  currentPiece.y += deltaY;
  return true;
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]).reverse());
}

function rotatePiece() {
  if (!currentPiece || currentPiece.type === "O") return;
  const rotated = rotateMatrix(currentPiece.matrix);
  const wallKicks = [0, -1, 1, -2, 2];
  const originalX = currentPiece.x;
  for (const offset of wallKicks) {
    if (!isOccupied(originalX + offset, currentPiece.y, rotated)) {
      currentPiece.matrix = rotated;
      currentPiece.x = originalX + offset;
      return;
    }
  }
}

function getDropDistance() {
  if (!currentPiece) return 0;
  let distance = 0;
  while (!isOccupied(currentPiece.x, currentPiece.y + distance + 1)) distance += 1;
  return distance;
}

function hardDrop() {
  if (!currentPiece || gameState !== "playing") return;
  const distance = getDropDistance();
  currentPiece.y += distance;
  score += distance * 2;
  lockPiece();
}

function softDrop() {
  if (!currentPiece || gameState !== "playing") return;
  if (movePiece(0, 1)) {
    score += 1;
    render();
  } else {
    lockPiece();
  }
  lastDropTime = performance.now();
}

function mergePiece() {
  currentPiece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!value) return;
      const boardY = currentPiece.y + rowIndex;
      const boardX = currentPiece.x + columnIndex;
      if (boardY >= 0) board[boardY][boardX] = currentPiece.type;
    });
  });
}

function clearLines() {
  const completedRows = board.filter((row) => row.every(Boolean)).length;
  if (completedRows === 0) return;

  board = board.filter((row) => !row.every(Boolean));
  while (board.length < ROWS) board.unshift(Array(COLS).fill(null));

  const lineScores = [0, 100, 300, 500, 800];
  score += lineScores[completedRows] * level;
  lines += completedRows;
  level = Math.floor(lines / 10) + 1;
}

function lockPiece() {
  mergePiece();
  clearLines();
  currentPiece = createPiece(nextType || drawType());
  nextType = drawType();

  if (isOccupied(currentPiece.x, currentPiece.y)) {
    currentPiece = null;
    setGameState("gameover");
    return;
  }

  lastDropTime = performance.now();
  render();
}

function dropInterval() {
  return Math.max(85, 800 - (level - 1) * 65);
}

function gameLoop(timestamp) {
  if (gameState !== "playing") return;
  if (timestamp - lastDropTime >= dropInterval()) {
    if (!movePiece(0, 1)) lockPiece();
    lastDropTime = timestamp;
    render();
  }
  animationFrame = requestAnimationFrame(gameLoop);
}

function startLoop() {
  cancelAnimationFrame(animationFrame);
  lastDropTime = performance.now();
  animationFrame = requestAnimationFrame(gameLoop);
}

function startGame() {
  board = createEmptyBoard();
  bag = [];
  score = 0;
  lines = 0;
  level = 1;
  nextType = drawType();
  currentPiece = createPiece(nextType);
  nextType = drawType();
  setGameState("playing");
  startLoop();
  render();
}

function togglePause() {
  if (gameState === "playing") {
    setGameState("paused");
  } else if (gameState === "paused") {
    setGameState("playing");
    startLoop();
  }
}

function getCellIndex(x, y) {
  return y * COLS + x;
}

function paintCell(cell, type, isGhost = false) {
  cell.classList.add(type ? `piece-${type.toLowerCase()}` : "");
  if (type) cell.classList.add(isGhost ? "ghost" : "filled");
}

function renderBoard() {
  const cells = [...boardElement.children];
  cells.forEach((cell) => {
    cell.className = "cell";
  });

  board.forEach((row, rowIndex) => {
    row.forEach((type, columnIndex) => {
      if (type) paintCell(cells[getCellIndex(columnIndex, rowIndex)], type);
    });
  });

  if (!currentPiece) return;
  const ghostY = currentPiece.y + getDropDistance();
  currentPiece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!value) return;
      const ghostX = currentPiece.x + columnIndex;
      const ghostRow = ghostY + rowIndex;
      if (ghostRow >= 0 && ghostRow < ROWS) paintCell(cells[getCellIndex(ghostX, ghostRow)], currentPiece.type, true);
    });
  });

  currentPiece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!value) return;
      const pieceX = currentPiece.x + columnIndex;
      const pieceY = currentPiece.y + rowIndex;
      if (pieceY >= 0 && pieceY < ROWS && pieceX >= 0 && pieceX < COLS) {
        const cell = cells[getCellIndex(pieceX, pieceY)];
        cell.classList.remove("ghost");
        paintCell(cell, currentPiece.type);
      }
    });
  });
}

function renderPreview() {
  const cells = [...nextBoardElement.children];
  cells.forEach((cell) => { cell.className = "cell"; });
  if (!nextType) return;

  const matrix = SHAPES[nextType];
  const offsetX = Math.floor((PREVIEW_SIZE - matrix[0].length) / 2);
  const offsetY = Math.floor((PREVIEW_SIZE - matrix.length) / 2);
  matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value) paintCell(cells[(offsetY + rowIndex) * PREVIEW_SIZE + offsetX + columnIndex], nextType);
    });
  });
}

function formatNumber(value, digits) {
  return String(value).padStart(digits, "0");
}

function setGameState(nextState) {
  gameState = nextState;
  const labels = {
    ready: ["READY", "WELCOME TO GRIDLINE", "준비됐나요?", "블록을 쌓고, 줄을 지우고, 최고 기록에 도전하세요.", "게임 시작", "READY WHEN YOU ARE"],
    playing: ["PLAYING", "KEEP BUILDING", "", "", "새 게임", "BUILD IN PROGRESS"],
    paused: ["PAUSED", "PAUSED", "잠시 멈췄어요", "호흡을 고르고, 계속하기를 눌러 다시 시작하세요.", "계속하기", "GAME PAUSED"],
    gameover: ["GAME OVER", "RUN COMPLETE", "게임 오버", "잘 쌓았습니다. 기록을 확인하고 다시 도전해보세요.", "다시 시작", "RUN COMPLETE"],
  }[nextState];

  modeBadge.textContent = labels[0];
  liveCopy.textContent = labels[5];
  overlayKicker.textContent = labels[1];
  overlayTitle.textContent = labels[2];
  overlayDescription.textContent = labels[3];
  overlayAction.textContent = labels[4];
  primaryAction.textContent = labels[4];
  overlay.classList.toggle("hidden", nextState === "playing");
  overlay.dataset.state = nextState;
  pauseButton.disabled = !["playing", "paused"].includes(nextState);
  pauseButton.textContent = nextState === "paused" ? "계속하기" : "일시정지";
  statusDot.style.background = nextState === "gameover" ? "#ff6e85" : nextState === "paused" ? "#ffd84d" : "var(--accent)";
  statusDot.style.boxShadow = nextState === "gameover" ? "0 0 14px rgba(255, 110, 133, 0.75)" : "0 0 14px rgba(216, 255, 79, 0.75)";
  render();
}

function render() {
  scoreValue.textContent = formatNumber(score, 6);
  linesValue.textContent = formatNumber(lines, 3);
  levelValue.textContent = formatNumber(level, 2);
  renderBoard();
  renderPreview();
}

function handlePrimaryAction() {
  if (gameState === "paused") {
    togglePause();
  } else {
    startGame();
  }
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();
  const isGameKey = ["arrowleft", "arrowright", "arrowdown", "arrowup", " "].includes(event.key) || key === "p" || key === "escape";
  if (isGameKey) event.preventDefault();

  if ((key === "p" || key === "escape") && ["playing", "paused"].includes(gameState)) {
    togglePause();
    return;
  }
  if (gameState !== "playing") {
    if ((event.key === "Enter" || event.key === " ") && ["ready", "gameover", "paused"].includes(gameState)) handlePrimaryAction();
    return;
  }

  if (event.key === "ArrowLeft") movePiece(-1, 0);
  if (event.key === "ArrowRight") movePiece(1, 0);
  if (event.key === "ArrowUp") rotatePiece();
  if (event.key === "ArrowDown") softDrop();
  if (event.key === " ") hardDrop();
  render();
}

createBoardCells();
createPreviewCells();
setGameState("ready");

overlayAction.addEventListener("click", handlePrimaryAction);
primaryAction.addEventListener("click", handlePrimaryAction);
pauseButton.addEventListener("click", togglePause);
document.addEventListener("keydown", handleKeydown);
