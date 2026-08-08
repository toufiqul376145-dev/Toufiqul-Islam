"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const menuPanel = document.getElementById("menu-panel");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const hudPauseBtn = document.getElementById("hud-pause-btn");
const themeBtn = document.getElementById("theme-btn");
const bestScoreLabel = document.getElementById("best-score-label");
const coinTotalLabel = document.getElementById("coin-total-label");
const menuStatus = document.getElementById("menu-status");

const keys = {};
const obstacles = [];
const birds = [];
const coins = [];
const powerUps = [];
const particles = [];
const clouds = [];
const mountains = [];
const floatingTexts = [];
const burstEffects = [];

let audioCtx = null;
let mute = false;
let shake = 0;
let lastTimestamp = 0;

const player = {
  x: 100,
  y: 0,
  w: 42,
  h: 58,
  vy: 0,
  jumpForce: 16,
  onGround: true,
  anim: 0,
  invulnerable: 0,
  trail: []
};

const game = {
  width: 0,
  height: 0,
  ground: 0,
  gravity: 0.82,
  baseSpeed: 7,
  speed: 7,
  score: 0,
  coinsCollected: 0,
  totalCoins: Number(localStorage.getItem("runnerTotalCoins")) || 0,
  best: Number(localStorage.getItem("runnerBest")) || 0,
  frame: 0,
  time: 0,
  difficulty: 1,
  level: 1,
  over: false,
  pause: false,
  started: false,
  theme: "day",
  combo: 1,
  lives: 3,
  maxLives: 3,
  shieldTime: 0,
  magnetTime: 0,
  boostTime: 0,
  sound: true,
  cameraShake: 0,
  mission: "Stay alive and keep the streak going."
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  game.width = canvas.width;
  game.height = canvas.height;
  game.ground = canvas.height - 96;

  if (player.y > game.ground - player.h) {
    player.y = game.ground - player.h;
  }

  if (clouds.length === 0) {
    makeScene();
  }
}

function initAudio() {
  if (mute || typeof window === "undefined") return;

  if (!audioCtx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) {
      audioCtx = new AudioCtor();
    }
  }

  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone(frequency, duration = 0.08, type = "square", volume = 0.04) {
  if (!game.sound || !audioCtx) return;

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  gainNode.gain.value = volume;
  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

function playCoinSound() {
  playTone(880, 0.07, "triangle", 0.045);
  setTimeout(() => playTone(1180, 0.09, "triangle", 0.04), 30);
}

function playJumpSound() {
  playTone(430, 0.08, "square", 0.04);
}

function playCrashSound() {
  playTone(180, 0.24, "sawtooth", 0.05);
}

function playPowerSound() {
  playTone(620, 0.10, "triangle", 0.05);
  setTimeout(() => playTone(760, 0.11, "triangle", 0.04), 55);
}

function toggleSound() {
  game.sound = !game.sound;
  mute = !game.sound;

  if (game.sound) {
    initAudio();
  }

  if (themeBtn) {
    themeBtn.textContent = game.theme === "night" ? "Day Mode" : "Night Mode";
  }
}

function addFloatingText(x, y, text, color = "#fff", size = 16) {
  floatingTexts.push({ x, y, text, color, size, life: 56, vy: -0.9 });
}

function addBurst(x, y, color = "#fff", count = 10) {
  for (let i = 0; i < count; i++) {
    burstEffects.push({
      x,
      y,
      color,
      vx: (Math.random() - 0.5) * 3.4,
      vy: (Math.random() - 0.7) * 3.1,
      size: 2 + Math.random() * 3,
      life: 18 + Math.random() * 18
    });
  }
}

function createClouds() {
  clouds.length = 0;
  for (let i = 0; i < 7; i++) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: 36 + Math.random() * 130,
      s: 22 + Math.random() * 30,
      speed: 0.4 + Math.random() * 0.9
    });
  }
}

function createMountains() {
  mountains.length = 0;
  for (let i = 0; i < 5; i++) {
    mountains.push({
      x: Math.random() * canvas.width,
      y: game.ground - 30 - Math.random() * 120,
      w: 180 + Math.random() * 220,
      h: 80 + Math.random() * 150,
      speed: 0.5 + i * 0.18,
      color: i % 2 === 0 ? "#9dd8bc" : "#84c7a4"
    });
  }
}

function makeScene() {
  createClouds();
  createMountains();
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = burstEffects.length - 1; i >= 0; i--) {
    const b = burstEffects[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life -= 1;
    if (b.life <= 0) burstEffects.splice(i, 1);
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.y += t.vy;
    t.life -= 1;
    if (t.life <= 0) floatingTexts.splice(i, 1);
  }
}

function dust(x, y, count = 10, spread = 1) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (-Math.random() * 3.5 - 0.4) * spread,
      vy: -Math.random() * 2.4,
      size: 2 + Math.random() * 3,
      life: 18 + Math.random() * 12
    });
  }
}

function jump() {
  if (!player.onGround || game.over || !game.started || game.pause) return;
  player.vy = -player.jumpForce;
  player.onGround = false;
  dust(player.x + 10, game.ground, 18, 1.5);
  playJumpSound();
}

function control() {
  if ((keys["Space"] || keys["ArrowUp"] || keys["KeyW"]) && player.onGround) {
    jump();
  }
}

function updatePlayer() {
  player.vy += game.gravity;
  player.y += player.vy;

  if (player.y >= game.ground - player.h) {
    player.y = game.ground - player.h;
    player.vy = 0;
    player.onGround = true;
    if (game.started && game.frame > 5) {
      dust(player.x + 8, game.ground + 4, 3, 0.8);
    }
  }

  player.anim++;
  if (player.invulnerable > 0) player.invulnerable -= 1;

  player.trail.push({ x: player.x + 20, y: player.y + 22, life: 16 });
  if (player.trail.length > 8) player.trail.shift();
  player.trail.forEach((point) => point.life -= 1);
  player.trail = player.trail.filter((point) => point.life > 0);
}

function addObstacle(x = canvas.width + 60, y = null) {
  const roll = Math.random();
  const kind = roll < 0.34 ? "cactus" : roll < 0.67 ? "rock" : "crate";
  const h = 42 + Math.random() * 52;
  const w = kind === "cactus" ? 28 + Math.random() * 11 : kind === "rock" ? 30 + Math.random() * 22 : 36 + Math.random() * 12;
  const itemY = y ?? (game.ground - (kind === "crate" ? 35 + Math.random() * 18 : h));

  obstacles.push({
    x,
    y: itemY,
    w,
    h: kind === "crate" ? 34 + Math.random() * 18 : h,
    kind,
    passed: false
  });
}

function addBird(x = canvas.width + 80, y = null) {
  let birdY = y ?? (game.ground - 160 - Math.random() * 90);

  if (y === null && obstacles.some((o) => o.x > canvas.width - 20 && o.x < canvas.width + 260)) {
    birdY = game.ground - 220 - Math.random() * 60;
  }

  const aggressive = Math.random() > 0.45;

  birds.push({
    x,
    baseY: birdY,
    y: birdY,
    w: aggressive ? 46 : 40,
    h: aggressive ? 24 : 20,
    wave: Math.random() * Math.PI * 2,
    speed: 1.1 + Math.random() * 1.0,
    aggressive,
    drift: (Math.random() - 0.5) * 18
  });
}

function addCoin(x = canvas.width + 50, y = null) {
  const coinY = y ?? (game.ground - 60 - Math.random() * 150);
  coins.push({
    x,
    y: coinY,
    r: 9,
    value: 10,
    spin: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2
  });
}

function spawnPowerUp(x = canvas.width + 80) {
  const opts = ["shield", "magnet", "boost"];
  const type = opts[Math.floor(Math.random() * opts.length)];
  powerUps.push({
    x,
    y: game.ground - 80 - Math.random() * 100,
    r: 12,
    type,
    spin: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2
  });
}

function applyPowerUp(type) {
  if (type === "shield") {
    game.shieldTime = 8;
    addFloatingText(player.x + 20, player.y - 10, "Shield +", "#7dd3fc", 18);
  }

  if (type === "magnet") {
    game.magnetTime = 8;
    addFloatingText(player.x + 20, player.y - 10, "Magnet +", "#facc15", 18);
  }

  if (type === "boost") {
    game.boostTime = 7;
    addFloatingText(player.x + 20, player.y - 10, "Boost +", "#f472b6", 18);
  }

  addBurst(player.x + player.w / 2, player.y + player.h / 2, "#fff", 18);
  playPowerSound();
}

function collectCoin(coin) {
  const index = coins.indexOf(coin);
  if (index >= 0) coins.splice(index, 1);

  const multiplier = game.boostTime > 0 ? 2 : 1;
  game.coinsCollected += 1;
  game.totalCoins += 1;
  game.score += coin.value * game.combo * multiplier;
  game.combo = Math.min(6, game.combo + 0.18);

  localStorage.setItem("runnerTotalCoins", String(game.totalCoins));
  localStorage.setItem("runnerBest", String(game.best));

  addBurst(coin.x, coin.y, "#fbbf24", 12);
  playCoinSound();
}

function updateObstacles() {
  const cactusInterval = Math.max(58, 112 - Math.floor(game.score / 24));
  const birdInterval = Math.max(170, 330 - Math.floor(game.score / 14));

  if (game.frame % cactusInterval === 0 && game.frame > 20) {
    addObstacle();
  }

  if (game.frame > 120 && game.frame % birdInterval === 0) {
    addBird();
  }

  if (game.frame > 35 && game.frame % 82 === 0) {
    addCoin();
  }

  if (game.frame > 180 && game.frame % 480 === 0) {
    spawnPowerUp();
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= game.speed;

    if (o.x + o.w < 0) {
      obstacles.splice(i, 1);
      continue;
    }

    if (!o.passed && o.x < player.x) {
      o.passed = true;
      game.score += 5;
      game.combo = 1;
    }
  }

  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i];
    const aggressionBoost = b.aggressive ? 1.8 : 1.2;
    b.x -= game.speed + aggressionBoost;
    b.wave += 0.16 + b.speed * 0.045;
    b.y = b.baseY + Math.sin(b.wave) * (b.aggressive ? 15 : 10) + Math.sin(b.wave * 1.7) * b.drift * 0.2;

    if (b.x + b.w < 0) birds.splice(i, 1);
  }

  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.x -= game.speed + 0.7;
    c.spin += 0.25;
    c.phase += 0.16;

    if (game.magnetTime > 0 && c.x < player.x + 220) {
      const dx = (player.x + player.w / 2) - c.x;
      const dy = (player.y + player.h / 2) - c.y;
      c.x += dx * 0.08;
      c.y += dy * 0.08;
    }

    if (c.x + c.r < 0) {
      coins.splice(i, 1);
      continue;
    }

    const coinBox = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
    if (rectsIntersect({ x: player.x + 6, y: player.y + 6, w: player.w - 12, h: player.h - 8 }, coinBox)) {
      collectCoin(c);
    }
  }

  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    p.x -= game.speed + 0.6;
    p.spin += 0.2;
    p.phase += 0.15;

    if (p.x + p.r < 0) {
      powerUps.splice(i, 1);
      continue;
    }

    const box = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
    if (rectsIntersect({ x: player.x + 4, y: player.y + 4, w: player.w - 8, h: player.h - 6 }, box)) {
      applyPowerUp(p.type);
      powerUps.splice(i, 1);
    }
  }
}

function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function hitPlayer() {
  if (player.invulnerable > 0) return;

  if (game.shieldTime > 0) {
    game.shieldTime = 0;
    player.invulnerable = 60;
    addFloatingText(player.x + 20, player.y - 10, "Shield broke!", "#fca5a5", 18);
    addBurst(player.x + player.w / 2, player.y + player.h / 2, "#fca5a5", 18);
    shake = 8;
    playCrashSound();
    return;
  }

  game.lives -= 1;
  player.invulnerable = 80;
  shake = 12;
  addBurst(player.x + player.w / 2, player.y + player.h / 2, "#fb7185", 24);
  playCrashSound();

  if (game.lives <= 0) {
    gameOver();
  } else {
    addFloatingText(player.x + 20, player.y - 10, "-1 life", "#fde68a", 18);
  }
}

function checkCollision() {
  const box = { x: player.x + 6, y: player.y + 6, w: player.w - 12, h: player.h - 8 };

  for (const o of obstacles) {
    if (rectsIntersect(box, o)) {
      hitPlayer();
      return;
    }
  }

  for (const b of birds) {
    if (rectsIntersect(box, b)) {
      hitPlayer();
      return;
    }
  }
}

function gameOver() {
  if (game.over) return;

  game.over = true;
  game.pause = false;
  game.started = true;
  shake = 16;

  if (game.score > game.best) {
    game.best = Math.floor(game.score);
    localStorage.setItem("runnerBest", String(game.best));
  }

  localStorage.setItem("runnerTotalCoins", String(game.totalCoins));
  addFloatingText(player.x + 20, player.y - 12, "Run over", "#fff", 18);
  addBurst(player.x + player.w / 2, player.y + player.h / 2, "#ff6b6b", 30);
  playCrashSound();
}

function updateMenu() {
  if (bestScoreLabel) bestScoreLabel.textContent = String(game.best);
  if (coinTotalLabel) coinTotalLabel.textContent = String(game.totalCoins);

  if (menuStatus) {
    if (!game.started) {
      menuStatus.textContent = "Dodge danger, collect coins, and chase the streak.";
    } else if (game.over) {
      menuStatus.textContent = "Run over � jump back in and beat your score.";
    } else if (game.pause) {
      menuStatus.textContent = "Paused � take a breath and continue.";
    } else {
      menuStatus.textContent = "Stay sharp and keep the streak alive.";
    }
  }

  if (hudPauseBtn) {
    if (!game.started || game.over) {
      hudPauseBtn.classList.add("hidden");
    } else {
      hudPauseBtn.classList.remove("hidden");
      hudPauseBtn.textContent = game.pause ? "Resume" : "Pause";
    }
  }

  if (!menuPanel) return;

  if (!game.started || game.over) {
    menuPanel.classList.remove("hidden");
    startBtn.textContent = game.over ? "Play Again" : "Start Game";
    pauseBtn.textContent = "Pause";
    if (themeBtn) themeBtn.textContent = game.theme === "night" ? "Day Mode" : "Night Mode";
    return;
  }

  if (game.pause) {
    menuPanel.classList.remove("hidden");
    startBtn.textContent = "Resume";
    pauseBtn.textContent = "Resume";
    if (themeBtn) themeBtn.textContent = game.theme === "night" ? "Day Mode" : "Night Mode";
    return;
  }

  menuPanel.classList.add("hidden");
}

function toggleTheme() {
  game.theme = game.theme === "day" ? "night" : "day";
  if (themeBtn) themeBtn.textContent = game.theme === "night" ? "Day Mode" : "Night Mode";
  updateMenu();
}

function startGame() {
  initAudio();

  if (game.over) {
    restartGame();
  }

  if (!game.started) {
    game.started = true;
    game.pause = false;
  }

  if (game.pause) {
    game.pause = false;
  }

  updateMenu();
}

function restartGame() {
  obstacles.length = 0;
  birds.length = 0;
  coins.length = 0;
  powerUps.length = 0;
  particles.length = 0;
  burstEffects.length = 0;
  floatingTexts.length = 0;
  shake = 0;

  game.score = 0;
  game.coinsCollected = 0;
  game.speed = game.baseSpeed;
  game.frame = 0;
  game.time = 0;
  game.difficulty = 1;
  game.level = 1;
  game.over = false;
  game.pause = false;
  game.started = true;
  game.combo = 1;
  game.lives = game.maxLives;
  game.shieldTime = 0;
  game.magnetTime = 0;
  game.boostTime = 0;
  game.mission = "Stay alive and keep the streak going.";

  player.x = 100;
  player.y = game.ground - player.h;
  player.vy = 0;
  player.onGround = true;
  player.anim = 0;
  player.invulnerable = 0;
  player.trail = [];

  keys.Space = false;
  keys.ArrowUp = false;
  keys.KeyW = false;
}

function updateGame() {
  if (!game.started) return;
  if (game.over) return;
  if (game.pause) return;

  if (shake > 0) shake = Math.max(0, shake - 0.7);

  control();
  updatePlayer();
  updateParticles();
  updateObstacles();
  checkCollision();

  game.frame++;
  game.time++;
  game.score += 0.15;
  game.level = 1 + Math.floor(game.score / 180);
  game.difficulty = 1 + game.score / 220;
  game.speed = Math.min(20, game.baseSpeed + game.score / 170 + game.difficulty * 0.45);
  game.combo = Math.max(1, game.combo - 0.003);

  game.shieldTime = Math.max(0, game.shieldTime - 1 / 60);
  game.magnetTime = Math.max(0, game.magnetTime - 1 / 60);
  game.boostTime = Math.max(0, game.boostTime - 1 / 60);

  if (game.score > game.best) {
    game.best = Math.floor(game.score);
    localStorage.setItem("runnerBest", String(game.best));
  }
}

function getThemeColors() {
  if (game.theme === "night") {
    return {
      skyTop: "#09131f",
      skyMid: "#122b46",
      skyBottom: "#274e73",
      glow: "rgba(144, 184, 255, 0.28)",
      sun: "#f5d76e",
      sunRing: "rgba(214, 224, 255, 0.35)",
      mountainA: "#203a4d",
      mountainB: "#102e3f",
      groundTop: "#4cc77d",
      groundBottom: "#166b43",
      cloud: "rgba(255,255,255,0.9)"
    };
  }

  return {
    skyTop: "#67c6ff",
    skyMid: "#9fe2ff",
    skyBottom: "#eefbff",
    glow: "rgba(255, 239, 153, 0.9)",
    sun: "#ffd166",
    sunRing: "rgba(255, 209, 102, 0.35)",
    mountainA: "#a8d5ba",
    mountainB: "#8ec5a8",
    groundTop: "#67c35b",
    groundBottom: "#2e8b57",
    cloud: "#ffffff"
  };
}

function drawSky() {
  const pal = getThemeColors();
  const dx = shake > 0 ? (Math.random() - 0.5) * shake * 2 : 0;
  const dy = shake > 0 ? (Math.random() - 0.5) * shake * 2 : 0;

  ctx.save();
  ctx.translate(dx, dy);

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, pal.skyTop);
  grad.addColorStop(0.5, pal.skyMid);
  grad.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(canvas.width - 120, 95, 22, canvas.width - 120, 95, 180);
  glow.addColorStop(0, pal.glow);
  glow.addColorStop(0.3, game.theme === "night" ? "rgba(126,155,255,0.18)" : "rgba(255,209,102,0.28)");
  glow.addColorStop(1, "rgba(255,209,102,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawSun();
  ctx.restore();
}

function drawSun() {
  const pal = getThemeColors();
  const pulse = Math.sin(game.frame * 0.06) * 7;

  ctx.fillStyle = pal.sun;
  ctx.beginPath();
  ctx.arc(canvas.width - 120, 95 + pulse, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = pal.sunRing;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(canvas.width - 120, 95 + pulse, 60 + pulse, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMountains() {
  const pal = getThemeColors();

  for (const m of mountains) {
    m.x -= m.speed;
    if (m.x < -m.w) {
      m.x = canvas.width + 60;
      m.y = game.ground - 40 - Math.random() * 120;
      m.h = 80 + Math.random() * 140;
    }

    ctx.fillStyle = m.color || pal.mountainA;
    ctx.beginPath();
    ctx.moveTo(m.x, canvas.height);
    ctx.lineTo(m.x + m.w * 0.5, m.y);
    ctx.lineTo(m.x + m.w, canvas.height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClouds() {
  const pal = getThemeColors();
  ctx.fillStyle = pal.cloud;

  for (const c of clouds) {
    c.x -= c.speed;
    if (c.x < -120) c.x = canvas.width + 80;

    ctx.beginPath();
    ctx.arc(c.x, c.y, c.s / 2, 0, Math.PI * 2);
    ctx.arc(c.x + 24, c.y - 12, c.s / 2, 0, Math.PI * 2);
    ctx.arc(c.x + 48, c.y, c.s / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGround() {
  const pal = getThemeColors();
  const roadTop = game.ground - 12;

  const g = ctx.createLinearGradient(0, roadTop, 0, canvas.height);
  g.addColorStop(0, pal.groundTop);
  g.addColorStop(1, pal.groundBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, roadTop, canvas.width, canvas.height - roadTop);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, roadTop, canvas.width, 6);

  ctx.fillStyle = game.theme === "night" ? "#2b8e5b" : "#96f08d";
  ctx.beginPath();
  ctx.moveTo(0, roadTop + 5);
  ctx.quadraticCurveTo(canvas.width * 0.22, roadTop - 18, canvas.width * 0.45, roadTop + 4);
  ctx.quadraticCurveTo(canvas.width * 0.7, roadTop - 12, canvas.width, roadTop + 5);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = game.theme === "night" ? "#1c4d3f" : "#2d5c40";
  ctx.lineWidth = 2;
  for (let i = -10; i < canvas.width + 40; i += 42) {
    ctx.beginPath();
    ctx.moveTo(i, roadTop + 10);
    ctx.lineTo(i + 18, roadTop + 24);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width + 60; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, roadTop + 14);
    ctx.lineTo(i + 14, roadTop + 22);
    ctx.stroke();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / 28;
    ctx.fillStyle = "#a8b6c8";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const b of burstEffects) {
    ctx.globalAlpha = b.life / 30;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const t of floatingTexts) {
    ctx.globalAlpha = Math.max(0, t.life / 56);
    ctx.fillStyle = t.color;
    ctx.font = `${t.size}px Arial`;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const run = Math.sin(player.anim * 0.35) * 6;
  const swing = Math.sin(player.anim * 0.45) * 8;

  if (game.shieldTime > 0) {
    ctx.strokeStyle = "rgba(125,211,252,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x + 22, player.y + 24, 28, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (player.invulnerable > 0 && Math.floor(player.invulnerable / 6) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  for (let i = 0; i < player.trail.length; i++) {
    const p = player.trail[i];
    ctx.fillStyle = `rgba(59, 130, 246, ${Math.max(0.1, p.life / 16)})`;
    ctx.fillRect(p.x - 6, p.y - 4, 12, 8);
  }

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(player.x + 22, game.ground + 6, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1d3557";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(player.x + 17, player.y + 48);
  ctx.lineTo(player.x + 17, player.y + 66 + run);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(player.x + 29, player.y + 48);
  ctx.lineTo(player.x + 29, player.y + 66 - run);
  ctx.stroke();

  ctx.strokeStyle = "#ffcc99";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(player.x + 12, player.y + 24);
  ctx.lineTo(player.x + 3, player.y + 38 + swing * 0.7);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(player.x + 34, player.y + 24);
  ctx.lineTo(player.x + 44, player.y + 38 - swing * 0.7);
  ctx.stroke();

  ctx.fillStyle = "#2d9cdb";
  ctx.beginPath();
  ctx.moveTo(player.x + 12, player.y + 18);
  ctx.quadraticCurveTo(player.x + 6, player.y + 32, player.x + 14, player.y + 48);
  ctx.lineTo(player.x + 34, player.y + 48);
  ctx.quadraticCurveTo(player.x + 41, player.y + 32, player.x + 30, player.y + 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#7ad0ff";
  ctx.fillRect(player.x + 16, player.y + 22, 12, 18);

  ctx.fillStyle = "#111";
  ctx.fillRect(player.x + 18, player.y + 26, 6, 12);
  ctx.fillRect(player.x + 15, player.y + 24, 12, 3);

  ctx.fillStyle = "#ffcc99";
  ctx.fillRect(player.x + 18, player.y + 8, 8, 10);
  ctx.beginPath();
  ctx.arc(player.x + 22, player.y + 10, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f2b3d";
  ctx.beginPath();
  ctx.arc(player.x + 22, player.y + 9, 15, 0, Math.PI, false);
  ctx.fill();

  ctx.fillStyle = "#101720";
  ctx.fillRect(player.x + 10, player.y + 1, 25, 8);

  ctx.fillStyle = "#111";
  ctx.fillRect(player.x + 17, player.y + 10, 3, 3);
  ctx.fillRect(player.x + 24, player.y + 10, 3, 3);

  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x + 22, player.y + 15, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.moveTo(player.x + 15, player.y + 22);
  ctx.lineTo(player.x + 8, player.y + 34);
  ctx.lineTo(player.x + 15, player.y + 42);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
}

function drawObstacles() {
  for (const o of obstacles) {
    if (o.kind === "rock") {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(o.x + o.w / 2, game.ground + 8, o.w * 0.8, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#8d99ae";
      ctx.beginPath();
      ctx.moveTo(o.x, o.y + o.h * 0.7);
      ctx.lineTo(o.x + o.w * 0.2, o.y);
      ctx.lineTo(o.x + o.w * 0.5, o.y + o.h * 0.15);
      ctx.lineTo(o.x + o.w * 0.82, o.y + o.h * 0.08);
      ctx.lineTo(o.x + o.w, o.y + o.h * 0.78);
      ctx.lineTo(o.x + o.w * 0.72, o.y + o.h);
      ctx.lineTo(o.x + o.w * 0.28, o.y + o.h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#70809d";
      ctx.beginPath();
      ctx.moveTo(o.x + o.w * 0.28, o.y + o.h * 0.72);
      ctx.lineTo(o.x + o.w * 0.52, o.y + o.h * 0.3);
      ctx.lineTo(o.x + o.w * 0.7, o.y + o.h * 0.78);
      ctx.lineTo(o.x + o.w * 0.52, o.y + o.h);
      ctx.closePath();
      ctx.fill();
      continue;
    }

    if (o.kind === "crate") {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(o.x + 2, game.ground + 4, o.w, 8);

      ctx.fillStyle = "#b9773f";
      ctx.fillRect(o.x, o.y, o.w, o.h);

      ctx.fillStyle = "#d08d5a";
      ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);

      ctx.strokeStyle = "#7c4a27";
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);

      ctx.strokeStyle = "rgba(93,52,25,0.85)";
      ctx.beginPath();
      ctx.moveTo(o.x + 5, o.y + 10);
      ctx.lineTo(o.x + o.w - 5, o.y + 10);
      ctx.moveTo(o.x + 5, o.y + o.h / 2);
      ctx.lineTo(o.x + o.w - 5, o.y + o.h / 2);
      ctx.moveTo(o.x + 5, o.y + o.h - 10);
      ctx.lineTo(o.x + o.w - 5, o.y + o.h - 10);
      ctx.stroke();
      continue;
    }

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(o.x + 3, game.ground + 6, o.w, 8);

    ctx.fillStyle = "#27ae60";
    ctx.fillRect(o.x, o.y, o.w, o.h);

    ctx.fillStyle = "#1e9e52";
    ctx.fillRect(o.x - 8, o.y + 18, 8, 12);
    ctx.fillRect(o.x + o.w, o.y + 8, 8, 12);

    ctx.fillStyle = "#2fbf70";
    ctx.fillRect(o.x + o.w * 0.25, o.y + 10, 7, o.h - 20);
    ctx.fillRect(o.x + o.w * 0.7, o.y + 4, 7, o.h - 15);

    ctx.strokeStyle = "#145a32";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(o.x + 4, o.y + 12);
    ctx.lineTo(o.x + o.w * 0.2, o.y + 12);
    ctx.moveTo(o.x + o.w * 0.8, o.y + 8);
    ctx.lineTo(o.x + o.w - 4, o.y + 8);
    ctx.stroke();
  }

  for (const b of birds) {
    const wingLift = Math.sin(b.wave) * 12;
    ctx.save();
    ctx.translate(b.x, b.y);

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(16, 18, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2b2f3a";
    ctx.beginPath();
    ctx.ellipse(16, 10, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dfe7ff";
    ctx.beginPath();
    ctx.ellipse(18, 11, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4f5565";
    ctx.beginPath();
    ctx.moveTo(18, 10);
    ctx.quadraticCurveTo(4, 2 - wingLift, 2, 18 + wingLift * 0.6);
    ctx.quadraticCurveTo(10, 22, 18, 16);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#303643";
    ctx.beginPath();
    ctx.arc(31, 8, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff8d5b";
    ctx.beginPath();
    ctx.moveTo(39, 9);
    ctx.lineTo(50, 11);
    ctx.lineTo(39, 15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(33, 7, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(34, 7.2, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#f4a261";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(15, 19);
    ctx.lineTo(12, 25);
    ctx.moveTo(19, 19);
    ctx.lineTo(20, 25);
    ctx.stroke();
    ctx.restore();
  }

  for (const c of coins) {
    const bob = Math.sin(c.phase) * 2.5;
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.rotate(c.spin);

    ctx.fillStyle = "#f9d423";
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#f1b00f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, c.r + 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#fff2a8";
    ctx.fillRect(-2, -c.r + 4, 4, c.r * 2 - 8);
    ctx.restore();
  }

  for (const p of powerUps) {
    const bob = Math.sin(p.phase) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(p.spin);

    if (p.type === "shield") {
      ctx.fillStyle = "#7dd3fc";
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dbeafe";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === "magnet") {
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff7b0";
      ctx.fillRect(-3, -5, 6, 10);
    } else {
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.fillRect(-2, -8, 4, 16);
    }
    ctx.restore();
  }
}

function drawHud() {
  ctx.fillStyle = "rgba(10, 16, 26, 0.68)";
  ctx.fillRect(18, 18, 246, 120);
  ctx.strokeStyle = "rgba(125, 211, 252, 0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 18, 246, 120);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 25px Arial";
  ctx.fillText("Score: " + Math.floor(game.score), 30, 52);

  ctx.font = "20px Arial";
  ctx.fillStyle = "#dbeafe";
  ctx.fillText("Best: " + game.best, 30, 82);
  ctx.fillText("Lives: " + game.lives, 30, 108);

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "18px Arial";
  ctx.fillText("Coins: " + game.coinsCollected, canvas.width - 185, 40);
  ctx.fillText("Level: " + game.level, canvas.width - 185, 64);
  ctx.fillText("Speed: " + game.speed.toFixed(1) + "x", canvas.width - 185, 88);

  const effects = [];
  if (game.shieldTime > 0) effects.push("Shield " + game.shieldTime.toFixed(1) + "s");
  if (game.magnetTime > 0) effects.push("Magnet " + game.magnetTime.toFixed(1) + "s");
  if (game.boostTime > 0) effects.push("Boost " + game.boostTime.toFixed(1) + "s");

  if (effects.length) {
    ctx.fillStyle = "rgba(12,18,28,0.78)";
    ctx.fillRect(canvas.width - 250, 100, 220, 24 + effects.length * 18);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.35)";
    ctx.strokeRect(canvas.width - 250, 100, 220, 24 + effects.length * 18);
    ctx.fillStyle = "#fef3c7";
    ctx.font = "15px Arial";
    effects.forEach((effect, index) => {
      ctx.fillText(effect, canvas.width - 236, 122 + index * 18);
    });
  }
}

function drawMission() {
  if (!game.started || game.over) return;

  ctx.fillStyle = "rgba(15,21,32,0.56)";
  ctx.fillRect(canvas.width / 2 - 220, canvas.height - 58, 440, 36);
  ctx.strokeStyle = "rgba(125, 211, 252, 0.2)";
  ctx.strokeRect(canvas.width / 2 - 220, canvas.height - 58, 440, 36);
  ctx.fillStyle = "#edf6ff";
  ctx.font = "16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(game.mission, canvas.width / 2, canvas.height - 34);
  ctx.textAlign = "left";
}

function drawOverlay() {
  if (!game.started) {
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(canvas.width / 2 - 220, canvas.height / 2 - 110, 440, 220);
    ctx.strokeStyle = "rgba(125, 211, 252, 0.32)";
    ctx.strokeRect(canvas.width / 2 - 220, canvas.height / 2 - 110, 440, 220);

    ctx.fillStyle = "#fff";
    ctx.font = "52px Arial";
    ctx.fillText("RUNNER", canvas.width / 2 - 135, canvas.height / 2 - 20);

    ctx.font = "24px Arial";
    ctx.fillText("Press Space to Start", canvas.width / 2 - 150, canvas.height / 2 + 30);
    ctx.fillText("Tap or click to jump", canvas.width / 2 - 140, canvas.height / 2 + 68);
  }

  if (game.pause && !game.over && game.started) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(canvas.width / 2 - 140, canvas.height / 2 - 58, 280, 116);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.26)";
    ctx.strokeRect(canvas.width / 2 - 140, canvas.height / 2 - 58, 280, 116);
    ctx.fillStyle = "#fff";
    ctx.font = "38px Arial";
    ctx.fillText("PAUSED", canvas.width / 2 - 95, canvas.height / 2 + 10);
  }

  if (game.over) {
    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.fillRect(canvas.width / 2 - 260, canvas.height / 2 - 120, 520, 220);
    ctx.strokeStyle = "rgba(248, 113, 113, 0.35)";
    ctx.strokeRect(canvas.width / 2 - 260, canvas.height / 2 - 120, 520, 220);

    ctx.fillStyle = "#fff";
    ctx.font = "48px Arial";
    ctx.fillText("GAME OVER", canvas.width / 2 - 170, canvas.height / 2 - 20);

    ctx.font = "24px Arial";
    ctx.fillText("Final Score: " + Math.floor(game.score), canvas.width / 2 - 120, canvas.height / 2 + 35);
    ctx.fillText("Coins: " + game.coinsCollected, canvas.width / 2 - 80, canvas.height / 2 + 70);
    ctx.fillText("Press Space to Restart", canvas.width / 2 - 150, canvas.height / 2 + 110);
  }
}

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;

  if (event.code === "KeyM") {
    toggleSound();
    event.preventDefault();
    return;
  }

  if (event.code === "KeyP" && game.started && !game.over) {
    game.pause = !game.pause;
    updateMenu();
    event.preventDefault();
    return;
  }

  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
    event.preventDefault();

    if (!game.started) {
      startGame();
      return;
    }

    if (game.over) {
      restartGame();
      updateMenu();
      return;
    }

    if (game.pause) {
      game.pause = false;
      updateMenu();
      return;
    }

    jump();
  }

  if (game.over && (event.code === "Enter" || event.code === "KeyR")) {
    event.preventDefault();
    restartGame();
    updateMenu();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

window.addEventListener("visibilitychange", () => {
  if (document.hidden && game.started && !game.over) {
    game.pause = true;
    updateMenu();
  }
});

window.addEventListener("pointerdown", (event) => {
  initAudio();

  if (event.target && (event.target.tagName === "BUTTON" || event.target.closest("button"))) return;

  if (!game.started) {
    startGame();
    return;
  }

  if (game.over) {
    restartGame();
    updateMenu();
    return;
  }

  if (game.pause) {
    game.pause = false;
    updateMenu();
    return;
  }

  jump();
});

startBtn.addEventListener("click", () => {
  if (!game.started || game.over) {
    startGame();
    return;
  }

  if (game.pause) {
    game.pause = false;
    updateMenu();
    return;
  }

  startGame();
});

pauseBtn.addEventListener("click", () => {
  if (!game.started || game.over) {
    startGame();
    return;
  }

  game.pause = !game.pause;
  updateMenu();
});

hudPauseBtn.addEventListener("click", () => {
  if (!game.started || game.over) return;
  game.pause = !game.pause;
  updateMenu();
});

themeBtn.addEventListener("click", () => {
  toggleTheme();
});

function loop(timestamp) {
  const delta = timestamp - lastTimestamp || 16;
  lastTimestamp = timestamp;

  updateGame();
  drawSky();
  drawMountains();
  drawClouds();
  drawGround();
  drawObstacles();
  drawParticles();
  drawPlayer();
  drawHud();
  drawMission();
  drawOverlay();

  requestAnimationFrame(loop);
}

resize();
player.y = game.ground - player.h;
makeScene();
updateMenu();
requestAnimationFrame(loop);
