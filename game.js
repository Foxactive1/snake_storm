// ════════════════════════════════════════════
//  AUDIO ENGINE
// ════════════════════════════════════════════
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function unlockAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, type, duration, vol = 0.15) {
  if (!audioCtx) return;
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

function sfxEat()  { playTone(880,  'square',   0.08, 0.12); playTone(1100, 'square', 0.06, 0.08); }
function sfxDie()  { playTone(200,  'sawtooth', 0.30, 0.20); playTone(120,  'sawtooth', 0.50, 0.15); }

// ════════════════════════════════════════════
//  CANVAS SETUP
// ════════════════════════════════════════════
const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
const wrap   = document.getElementById('canvas-wrap');

const GRID = 20;
let cols, rows;

function resizeCanvas() {
  const dpad  = document.getElementById('dpad');
  const hud   = document.getElementById('hud');
  const dpadH = dpad.offsetHeight || 0;
  const hudH  = hud.offsetHeight  || 0;
  const avail = Math.min(window.innerHeight - hudH - dpadH - 8, window.innerWidth);
  const size  = Math.min(avail, 500);
  canvas.width  = Math.floor(size / GRID) * GRID;
  canvas.height = Math.floor(size / GRID) * GRID;
  cols = canvas.width  / GRID;
  rows = canvas.height / GRID;
}

window.addEventListener('resize', () => {
  resizeCanvas();
  if (gameState !== 'playing') drawStatic();
});
resizeCanvas();

// ════════════════════════════════════════════
//  GAME STATE
// ════════════════════════════════════════════
let snake, dir, nextDir, food, score, highScore, speed, gameState;
let lastTime = 0, accumulator = 0;
let foodPulse = 0;
let particles = [];

highScore = parseInt(localStorage.getItem('snakeNeonHigh') || '0');
document.getElementById('best-val').textContent = highScore;

gameState = 'start';

function resetGame() {
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);
  snake      = [{ x: midX, y: midY }, { x: midX - 1, y: midY }];
  dir        = { x: 1, y: 0 };
  nextDir    = { x: 1, y: 0 };
  score      = 0;
  speed      = 7;
  particles  = [];
  placeFood();
  updateScoreUI();
  gameState = 'playing';
}

function placeFood() {
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows)
    };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  food = pos;
}

function updateScoreUI() {
  document.getElementById('score-val').textContent = score;
  document.getElementById('best-val').textContent  = highScore;
}

// ════════════════════════════════════════════
//  PARTICLES
// ════════════════════════════════════════════
function spawnParticles(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 1 + Math.random() * 3;
    particles.push({
      x: x * GRID + GRID / 2,
      y: y * GRID + GRID / 2,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1,
      color
    });
  }
}

// ════════════════════════════════════════════
//  UPDATE LOGIC
// ════════════════════════════════════════════
function update() {
  if (gameState !== 'playing') return;

  dir = { ...nextDir };
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows) {
    triggerGameOver(); return;
  }
  for (let s of snake) {
    if (head.x === s.x && head.y === s.y) { triggerGameOver(); return; }
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score++;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('snakeNeonHigh', highScore);
    }
    speed += 0.25;
    updateScoreUI();
    spawnParticles(food.x, food.y, '#ff00ff', 12);
    sfxEat();
    placeFood();
  } else {
    snake.pop();
  }
}

function triggerGameOver() {
  gameState = 'gameover';
  sfxDie();
  spawnParticles(snake[0].x, snake[0].y, '#ff0066', 20);
  document.getElementById('over-score-text').textContent =
    'SCORE: ' + score + (score === highScore && score > 0 ? '  🏆 NEW BEST!' : '');
  showOverlay('overlay-over');
}

// ════════════════════════════════════════════
//  DRAW
// ════════════════════════════════════════════
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
}

function drawGrid() {
  ctx.strokeStyle = '#ffffff06';
  ctx.lineWidth   = 0.5;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath(); ctx.moveTo(c * GRID, 0); ctx.lineTo(c * GRID, canvas.height); ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * GRID); ctx.lineTo(canvas.width, r * GRID); ctx.stroke();
  }
}

function drawSnake() {
  snake.forEach((s, i) => {
    const t          = i / snake.length;
    const alpha      = 1 - t * 0.5;
    ctx.shadowBlur   = i === 0 ? 30 : 14;
    ctx.shadowColor  = `rgba(0,245,255,${alpha})`;
    const brightness = Math.floor(255 * (1 - t * 0.4));
    ctx.fillStyle    = `rgb(0,${brightness},${brightness})`;
    roundRect(ctx, s.x * GRID + 1, s.y * GRID + 1, GRID - 2, GRID - 2, i === 0 ? 6 : 4);
    ctx.fill();
    if (i === 0) {
      ctx.shadowBlur = 0;
      ctx.fillStyle  = '#ffffff66';
      ctx.beginPath();
      ctx.arc(s.x * GRID + 5,          s.y * GRID + 5, 2, 0, Math.PI * 2);
      ctx.arc(s.x * GRID + GRID - 5,   s.y * GRID + 5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.shadowBlur = 0;
}

function drawFood() {
  foodPulse        = (foodPulse + 0.08) % (Math.PI * 2);
  const glow       = 18 + Math.sin(foodPulse) * 10;
  const scale      = 0.85 + Math.sin(foodPulse) * 0.1;
  const cx         = food.x * GRID + GRID / 2;
  const cy         = food.y * GRID + GRID / 2;
  const half       = (GRID / 2 - 1) * scale;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowBlur  = glow;
  ctx.shadowColor = '#ff00ff';
  ctx.fillStyle   = '#ff00ff';
  roundRect(ctx, -half, -half, half * 2, half * 2, 4);
  ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = '#ffffff44';
  roundRect(ctx, -half + 2, -half + 2, half - 2, half - 4, 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  particles = particles.filter(p => p.life > 0.01);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    p.vy     += 0.1;
    p.life   *= 0.9;
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowBlur  = 6;
    ctx.shadowColor = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

function drawFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawParticles();
  if (snake) drawSnake();
  if (food)  drawFood();
}

function drawStatic() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
}

// ════════════════════════════════════════════
//  GAME LOOP
// ════════════════════════════════════════════
function loop(ts) {
  requestAnimationFrame(loop);
  if (gameState !== 'playing') { drawFrame(); return; }

  const dt = ts - lastTime;
  lastTime  = ts;
  accumulator += dt;

  const interval = 1000 / speed;
  if (accumulator >= interval) {
    accumulator -= interval;
    update();
  }
  drawFrame();
}
requestAnimationFrame(loop);

// ════════════════════════════════════════════
//  OVERLAY HELPERS
// ════════════════════════════════════════════
function showOverlay(id) {
  ['overlay-start', 'overlay-over', 'overlay-pause'].forEach(n => {
    document.getElementById(n).classList.remove('show');
  });
  if (id) document.getElementById(id).classList.add('show');
}

// ════════════════════════════════════════════
//  CONTROLS – Keyboard
// ════════════════════════════════════════════
const dirMap = {
  ArrowUp:    { x:  0, y: -1 }, w: { x:  0, y: -1 }, W: { x:  0, y: -1 },
  ArrowDown:  { x:  0, y:  1 }, s: { x:  0, y:  1 }, S: { x:  0, y:  1 },
  ArrowLeft:  { x: -1, y:  0 }, a: { x: -1, y:  0 }, A: { x: -1, y:  0 },
  ArrowRight: { x:  1, y:  0 }, d: { x:  1, y:  0 }, D: { x:  1, y:  0 },
};

function tryDir(d) {
  if (!d) return;
  if (d.x !== 0 && d.x === -dir.x) return;
  if (d.y !== 0 && d.y === -dir.y) return;
  nextDir = d;
}

window.addEventListener('keydown', e => {
  unlockAudio();
  if (dirMap[e.key]) { e.preventDefault(); tryDir(dirMap[e.key]); return; }
  if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
    if (gameState === 'playing') { gameState = 'paused'; showOverlay('overlay-pause'); return; }
    if (gameState === 'paused')  { gameState = 'playing'; showOverlay(null); return; }
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (gameState === 'start' || gameState === 'gameover') { resetGame(); showOverlay(null); }
  }
});

// ════════════════════════════════════════════
//  CONTROLS – Buttons
// ════════════════════════════════════════════
document.getElementById('btn-start').addEventListener('click',  () => { unlockAudio(); resetGame(); showOverlay(null); });
document.getElementById('btn-retry').addEventListener('click',  () => { unlockAudio(); resetGame(); showOverlay(null); });
document.getElementById('btn-resume').addEventListener('click', () => { unlockAudio(); gameState = 'playing'; showOverlay(null); });
document.getElementById('btn-pause').addEventListener('click',  () => {
  unlockAudio();
  if (gameState === 'playing') { gameState = 'paused';  showOverlay('overlay-pause'); }
  else if (gameState === 'paused')  { gameState = 'playing'; showOverlay(null); }
});

// ════════════════════════════════════════════
//  CONTROLS – D-Pad
// ════════════════════════════════════════════
const dpadDirs = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
['up','down','left','right'].forEach(name => {
  const btn     = document.getElementById('d-' + name);
  const handler = e => {
    e.preventDefault(); unlockAudio();
    if (gameState === 'start' || gameState === 'gameover') { resetGame(); showOverlay(null); }
    tryDir(dpadDirs[name]);
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 150);
  };
  btn.addEventListener('touchstart', handler, { passive: false });
  btn.addEventListener('mousedown',  handler);
});

// ════════════════════════════════════════════
//  CONTROLS – Swipe
// ════════════════════════════════════════════
let touchStart = null;
canvas.addEventListener('touchstart', e => {
  unlockAudio();
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
    if (gameState === 'start' || gameState === 'gameover') { resetGame(); showOverlay(null); }
    touchStart = null; return;
  }
  if (Math.abs(dx) > Math.abs(dy)) tryDir(dx > 0 ? { x:1,y:0 } : { x:-1,y:0 });
  else                              tryDir(dy > 0 ? { x:0,y:1 } : { x:0,y:-1 });
  touchStart = null;
  e.preventDefault();
}, { passive: false });

// ════════════════════════════════════════════
//  AUTO-PAUSE ON BLUR
// ════════════════════════════════════════════
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameState === 'playing') {
    gameState = 'paused';
    showOverlay('overlay-pause');
  }
});

// Initial draw
drawStatic();
  
