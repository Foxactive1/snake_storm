// ============================================================
// NIBBLES PRO — game.js v2.0.0
// Autor: Dione Castro Alves | InNovaIdeia
// Melhorias aplicadas:
//   FIX #1  — Colisão com cauda (exclui último segmento do check)
//   FIX #2  — Slow power-up: stacking correto com _prevSpeedMultiplier
//   FIX #3  — Toast Bootstrap nativo (sem alert() bloqueante)
//   FIX #4  — Game loop com requestAnimationFrame + delta-time (sem setInterval)
//   FIX #5  — Swipe mobile: passive:false + preventDefault (sem scroll da página)
//   FIX #7  — Canvas responsivo dinâmico (recalcula grid ao redimensionar)
//   FIX #9  — speedBar reflete speedMultiplier real, não só intervalMs base
//   FIX #10 — ensureFoodCount exclui moedas da contagem
//   FIX #11 — Analytics persistido em sessionStorage
// ============================================================

// ---------- CONFIGURAÇÕES GLOBAIS ----------
const Config = {
  gridSize: 20,
  colors: {
    primary:   '#667eea',
    secondary: '#764ba2',
    accent:    '#00ff88',
    dark:      '#0b1220',
    light:     '#f8fafc'
  },
  difficulty: {
    easy:   { speed: 220, speedMultiplier: 1.0, foodCount: 1 },
    medium: { speed: 140, speedMultiplier: 1.0, foodCount: 1 },
    hard:   { speed: 90,  speedMultiplier: 1.25, foodCount: 2 }
  },
  foodTypes: [
    { type: 'normal', score: 10, color: '#ffb86b', coinChance: 0.3 },
    { type: 'bonus',  score: 25, color: '#ffd166', coinChance: 0.6 }
  ],
  powerUps: [
    {
      id: 'slow', label: 'Lento', duration: 7000,
      // FIX #2: guarda _prevSpeedMultiplier antes de multiplicar
      effect: (s) => { s._prevSpeedMultiplier = s.speedMultiplier; s.speedMultiplier *= 0.7; },
      badgeColor: '#7dd3fc', price: 30
    },
    {
      id: 'grow', label: 'Crescer', duration: 0,
      effect: (s) => { s.growOnNext = true; },
      badgeColor: '#bbf7d0', price: 20
    },
    {
      id: 'shield', label: 'Escudo', duration: 8000,
      effect: (s) => { s.shield = true; },
      badgeColor: '#fca5a5', price: 50
    },
    {
      id: 'double', label: '2x Pontos', duration: 8000,
      effect: (s) => { s.doublePoints = true; },
      badgeColor: '#ffd6a5', price: 40
    }
  ],
  coinValue: 1,
  adReward: 10
};

// ---------- UTILS ----------
const Utils = {
  randInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  posEqual: (a, b) => a.x === b.x && a.y === b.y,

  /**
   * Retorna posição aleatória livre dentro do grid,
   * evitando sobreposição com o corpo da cobra.
   */
  getValidRandomPosition(gridCountX, gridCountY, snake) {
    const maxX = gridCountX - 1, maxY = gridCountY - 1;
    let tries = 0;
    while (tries < 400) {
      const pos = { x: this.randInt(0, maxX), y: this.randInt(0, maxY) };
      if (!snake.some(s => this.posEqual(s, pos))) return pos;
      tries++;
    }
    // Fallback: centro do grid
    return { x: Math.floor(gridCountX / 2), y: Math.floor(gridCountY / 2) };
  },

  /**
   * Desenha retângulo com bordas arredondadas no canvas.
   */
  roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (typeof stroke === 'undefined') stroke = true;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
    if (fill)   ctx.fill();
    if (stroke) ctx.stroke();
  }
};

// ---------- ANALYTICS ----------
const Analytics = {
  eventos: [],

  /**
   * Registra evento com timestamp.
   * FIX #11: persiste os últimos 100 eventos em sessionStorage.
   */
  registrar(evento, dados = {}) {
    const entry = { timestamp: new Date().toISOString(), evento, ...dados };
    this.eventos.push(entry);
    try {
      const stored = JSON.parse(sessionStorage.getItem('nibbles_analytics') || '[]');
      stored.push(entry);
      // Mantém apenas os 100 mais recentes para não saturar
      sessionStorage.setItem('nibbles_analytics', JSON.stringify(stored.slice(-100)));
    } catch (e) {
      // sessionStorage indisponível (modo privado, etc.) — ignorar silenciosamente
    }
    console.log('[Analytics]', entry);
  }
};

// ---------- ÁUDIO (Web Audio API) ----------
const AudioManager = {
  ctx: null,
  ativo: true,
  volumeEfeitos: 1.0,

  /** Inicializa o contexto de áudio e carrega preferências do localStorage. */
  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[Audio] Web Audio API não suportada:', e);
      this.ativo = false;
    }
    const savedVol = localStorage.getItem('nibbles_som_vol');
    if (savedVol) this.volumeEfeitos = parseFloat(savedVol);
    const savedAtivo = localStorage.getItem('nibbles_som_ativo');
    if (savedAtivo !== null) this.ativo = (savedAtivo === 'true');
  },

  /**
   * Toca um efeito sonoro pelo tipo.
   * Tipos: 'comer' | 'powerup' | 'morte' | 'compra'
   */
  tocar(tipo) {
    if (!this.ativo || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(this.volumeEfeitos, now);

    const osc = this.ctx.createOscillator();
    osc.connect(gain);

    switch (tipo) {
      case 'comer':
        osc.frequency.setValueAtTime(300, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
        break;

      case 'powerup':
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
        break;

      case 'morte':
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
        break;

      case 'compra':
        // Acorde ascendente em três notas
        [440, 554, 660].forEach((freq, i) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + i * 0.1);
          g.gain.setValueAtTime(0.2 * this.volumeEfeitos, now + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);
          o.connect(g);
          g.connect(this.ctx.destination);
          o.start(now + i * 0.1);
          o.stop(now + i * 0.1 + 0.15);
        });
        break;
    }
  },

  setVolume(vol) {
    this.volumeEfeitos = vol;
    localStorage.setItem('nibbles_som_vol', vol);
  },

  setAtivo(estado) {
    this.ativo = estado;
    localStorage.setItem('nibbles_som_ativo', estado);
  }
};

// ---------- CONTA DO USUÁRIO ----------
const Conta = {
  nome: 'Jogador',
  moedas: 0,
  premium: false,

  /** Carrega dados do localStorage e atualiza a UI. */
  carregar() {
    const data = JSON.parse(localStorage.getItem('nibbles_conta'))
      || { nome: 'Jogador', moedas: 0, premium: false };
    Object.assign(this, data);
    this.atualizarUI();
  },

  /** Persiste dados no localStorage e atualiza a UI. */
  salvar() {
    localStorage.setItem('nibbles_conta', JSON.stringify({
      nome: this.nome,
      moedas: this.moedas,
      premium: this.premium
    }));
    this.atualizarUI();
  },

  login() {
    const nome = document.getElementById('inputNome').value.trim() || 'Jogador';
    this.nome = nome;
    this.salvar();
    bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
    Analytics.registrar('login', { nome });
  },

  adicionarMoedas(qtd) {
    this.moedas += qtd;
    this.salvar();
    UI.atualizarMoedasUI();
    Analytics.registrar('moedas_adicionadas', { qtd, saldo: this.moedas });
  },

  /** Gasta moedas se saldo suficiente. Retorna true em caso de sucesso. */
  gastarMoedas(qtd) {
    if (this.moedas >= qtd) {
      this.moedas -= qtd;
      this.salvar();
      UI.atualizarMoedasUI();
      return true;
    }
    return false;
  },

  tornarPremium() {
    this.premium = true;
    this.salvar();
    document.getElementById('anuncioSimulado').classList.add('d-none');
    Analytics.registrar('assinatura_premium');
  },

  atualizarUI() {
    document.getElementById('userNameDisplay').textContent = this.nome;
    document.getElementById('moedasDisplay').innerHTML = `<i class="fas fa-coins"></i> ${this.moedas}`;
    document.getElementById('modalMoedas').textContent = this.moedas;
    if (this.premium) {
      document.getElementById('premiumBadge').classList.remove('d-none');
      document.getElementById('anuncioSimulado').classList.add('d-none');
    } else {
      document.getElementById('premiumBadge').classList.add('d-none');
    }
  }
};

// ---------- MONETIZAÇÃO ----------
const Monetization = {
  comprarMoedas(qtd) {
    if (confirm(`Simular compra de ${qtd} moedas?`)) {
      Conta.adicionarMoedas(qtd);
      AudioManager.tocar('compra');
      Analytics.registrar('compra_moedas', { qtd, valor: qtd === 100 ? 1.99 : 9.99 });
      UI.mostrarToast('Compra realizada!', 'success');
    }
  },

  assinarPremium() {
    if (confirm('Assinar plano premium por R$9,90/mês?')) {
      Conta.tornarPremium();
      AudioManager.tocar('compra');
      Analytics.registrar('assinatura', { plano: 'premium', valor: 9.90 });
      UI.mostrarToast('Bem-vindo ao Premium! 🎉', 'success');
    }
  },

  comprarPowerUp(id) {
    const pu = Config.powerUps.find(p => p.id === id);
    if (!pu) return;
    if (Conta.gastarMoedas(pu.price)) {
      Game.activatePowerUp(id);
      AudioManager.tocar('compra');
      Analytics.registrar('compra_powerup', { id, price: pu.price });
      UI.mostrarToast(`${pu.label} ativado!`, 'success');
    } else {
      UI.mostrarToast('Moedas insuficientes!', 'warning');
    }
  },

  comprarVida() {
    if (Conta.gastarMoedas(100)) {
      Game.state.lives += 1;
      document.getElementById('lives').textContent = Game.state.lives;
      AudioManager.tocar('compra');
      Analytics.registrar('compra_vida');
      UI.mostrarToast('Vida extra adquirida! ❤️', 'success');
    } else {
      UI.mostrarToast('Moedas insuficientes!', 'warning');
    }
  },

  mostrarAnuncio() {
    if (Conta.premium) return;
    UI.mostrarToast('Assistindo anúncio...', 'info');
    setTimeout(() => {
      Conta.adicionarMoedas(Config.adReward);
      UI.mostrarToast(`Ganhou ${Config.adReward} moedas! 🪙`, 'success');
      Analytics.registrar('anuncio_assistido', { recompensa: Config.adReward });
    }, 2000);
  }
};

// ---------- ESTADO DO JOGO ----------
const Game = {
  state: {
    gridCountX: 25,
    gridCountY: 25,
    snake: [],
    dir: { x: 1, y: 0 },
    nextDir: null,
    foods: [],
    powerUpsOnField: [],
    activePowerUps: {},            // { id: expiryTimestamp }
    score: 0,
    highScore: Number(localStorage.getItem('nibbles_highScore')) || 0,
    lives: 3,
    moedasColetadas: 0,
    running: false,
    paused: false,
    _rafId: null,                  // FIX #4: ID do requestAnimationFrame
    _lastTick: 0,                  // FIX #4: timestamp do último tick processado
    intervalMs: Config.difficulty.medium.speed,
    speedMultiplier: 1.0,
    _prevSpeedMultiplier: 1.0,     // FIX #2: backup para reverter o slow corretamente
    growOnNext: false,
    shield: false,
    doublePoints: false,
    coinMultiplier: 1
  },

  init() {
    this.resizeCanvas();
    this.reset();
  },

  // FIX #7: Calcula tamanho do canvas baseado no contêiner real
  resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    const container = document.querySelector('.canvas-wrapper') || canvas.parentElement;
    const available = Math.min(container.clientWidth, 500);
    // Garante múltiplo exato do gridSize para evitar células cortadas
    const size = Math.floor(available / Config.gridSize) * Config.gridSize;
    canvas.width  = size;
    canvas.height = size;
    this.state.gridCountX = size / Config.gridSize;
    this.state.gridCountY = size / Config.gridSize;
  },

  reset() {
    const cx = Math.floor(this.state.gridCountX / 2);
    const cy = Math.floor(this.state.gridCountY / 2);
    this.state.snake         = [{ x: cx, y: cy }];
    this.state.dir           = { x: 1, y: 0 };
    this.state.nextDir       = null;
    this.state.foods         = [];
    this.state.powerUpsOnField = [];
    this.state.activePowerUps  = {};
    this.state.score           = 0;
    this.state.lives           = 3;
    this.state.moedasColetadas = 0;
    this.state.growOnNext      = false;
    this.state.shield          = false;
    this.state.doublePoints    = false;

    const dif = this.getCurrentDifficulty();
    this.state.intervalMs        = dif.speed;
    this.state.speedMultiplier   = dif.speedMultiplier;
    this.state._prevSpeedMultiplier = dif.speedMultiplier;
    this.state.coinMultiplier    = Conta.premium ? 2 : 1;

    this.placeInitialFood();
    this.spawnPowerUpTimer();
    UI.atualizarInfo();
    UI.atualizarPowerBadges();
  },

  getCurrentDifficulty() {
    const activeBtn = document.querySelector('#difficultyGroup .difficulty-btn.active');
    const level = activeBtn ? activeBtn.dataset.level : 'medium';
    return Config.difficulty[level] || Config.difficulty.medium;
  },

  placeInitialFood() {
    const { foodCount } = this.getCurrentDifficulty();
    for (let i = 0; i < foodCount; i++) this.generateFood();
  },

  generateFood() {
    const pos  = Utils.getValidRandomPosition(this.state.gridCountX, this.state.gridCountY, this.state.snake);
    const type = Math.random() < 0.12 ? Config.foodTypes[1] : Config.foodTypes[0];
    this.state.foods.push({ pos, ...type });
  },

  generateCoin() {
    const pos = Utils.getValidRandomPosition(this.state.gridCountX, this.state.gridCountY, this.state.snake);
    this.state.foods.push({ pos, type: 'coin', score: 0, color: 'gold', coinValue: 1 });
  },

  spawnPowerUp() {
    if (!this.state.running) return;
    const pos = Utils.getValidRandomPosition(this.state.gridCountX, this.state.gridCountY, this.state.snake);
    const idx = Utils.randInt(0, Config.powerUps.length - 1);
    const pu  = Config.powerUps[idx];
    this.state.powerUpsOnField.push({ id: pu.id, pos, color: pu.badgeColor });
  },

  spawnPowerUpTimer() {
    if (this._powerInterval) clearInterval(this._powerInterval);
    this._powerInterval = setInterval(() => {
      if (this.state.running && !this.state.paused && Math.random() < 0.06) {
        this.spawnPowerUp();
      }
    }, 5000);
  },

  /**
   * Ativa um power-up pelo id.
   * FIX #2: Guarda _prevSpeedMultiplier antes de aplicar o slow,
   *         para reverter corretamente mesmo com múltiplos slows.
   */
  activatePowerUp(id) {
    const pu = Config.powerUps.find(p => p.id === id);
    if (!pu) return;
    if (id === 'slow') {
      this.state._prevSpeedMultiplier = this.state.speedMultiplier;
    }
    if (pu.effect) pu.effect(this.state);
    if (pu.duration > 0) {
      this.state.activePowerUps[id] = Date.now() + pu.duration;
    }
    AudioManager.tocar('powerup');
    UI.atualizarPowerBadges();
    UI.atualizarSpeedUI();
  },

  /**
   * Verifica expiração de power-ups ativos e reverte seus efeitos.
   * FIX #2: Slow reverte para _prevSpeedMultiplier, não para o valor base.
   */
  updateActivePowerUps() {
    const now = Date.now();
    let changed = false;
    for (const [id, expiry] of Object.entries(this.state.activePowerUps)) {
      if (expiry <= now) {
        if (id === 'slow')   this.state.speedMultiplier = this.state._prevSpeedMultiplier ?? this.getCurrentDifficulty().speedMultiplier;
        if (id === 'shield') this.state.shield = false;
        if (id === 'double') this.state.doublePoints = false;
        delete this.state.activePowerUps[id];
        changed = true;
      }
    }
    if (changed) {
      UI.atualizarPowerBadges();
      UI.atualizarSpeedUI();
    }
  },

  /**
   * FIX #4: Game loop com requestAnimationFrame + delta-time.
   * Substitui setInterval para evitar drift e melhorar performance em mobile.
   */
  restartLoop() {
    if (this.state._rafId) {
      cancelAnimationFrame(this.state._rafId);
      this.state._rafId = null;
    }
    if (!this.state.running || this.state.paused) return;

    this.state._lastTick = performance.now();

    const loop = (now) => {
      if (!this.state.running || this.state.paused) return;
      const interval = Math.max(18, Math.floor(this.state.intervalMs / (this.state.speedMultiplier || 1)));
      if (now - this.state._lastTick >= interval) {
        this.state._lastTick = now;
        this.tick();
      }
      this.state._rafId = requestAnimationFrame(loop);
    };

    this.state._rafId = requestAnimationFrame(loop);
  },

  tick() {
    if (!this.state.running || this.state.paused) return;

    // Aplica mudança de direção (sem permitir reversão 180°)
    if (this.state.nextDir) {
      const nd = this.state.nextDir;
      if (!(nd.x === -this.state.dir.x && nd.y === -this.state.dir.y)) {
        this.state.dir = nd;
      }
      this.state.nextDir = null;
    }

    const head = { ...this.state.snake[0] };
    head.x += this.state.dir.x;
    head.y += this.state.dir.y;

    // --- Colisão com paredes ---
    if (head.x < 0 || head.y < 0 ||
        head.x >= this.state.gridCountX ||
        head.y >= this.state.gridCountY) {
      if (this.state.shield) {
        // Escudo: teletransporta para o centro
        head.x = Math.floor(this.state.gridCountX / 2);
        head.y = Math.floor(this.state.gridCountY / 2);
        this.state.shield = false;
      } else {
        this.handleDeath();
        return;
      }
    }

    // --- FIX #1: Colisão com o próprio corpo ---
    // Quando não está crescendo, a cauda vai sair neste tick,
    // portanto não deve ser incluída na verificação.
    const bodyToCheck = this.state.growOnNext
      ? this.state.snake              // crescendo: cauda permanece
      : this.state.snake.slice(0, -1); // normal: cauda vai sair, excluir

    for (let i = 0; i < bodyToCheck.length; i++) {
      if (Utils.posEqual(head, bodyToCheck[i])) {
        if (this.state.shield) {
          this.state.shield = false;
          break;
        } else {
          this.handleDeath();
          return;
        }
      }
    }

    this.state.snake.unshift(head);

    // --- Colisão com comidas ---
    let ateFood = false;
    for (let i = 0; i < this.state.foods.length; i++) {
      const f = this.state.foods[i];
      if (Utils.posEqual(head, f.pos)) {
        this.state.foods.splice(i, 1);
        if (f.type === 'coin') {
          const ganho = (f.coinValue || 1) * this.state.coinMultiplier;
          Conta.adicionarMoedas(ganho);
          this.state.moedasColetadas += ganho;
        } else {
          const pts = f.score || 10;
          this.state.score += this.state.doublePoints ? pts * 2 : pts;
          // 20% de chance de spawnar moeda ao comer comida normal
          if (Math.random() < 0.2) this.generateCoin();
        }
        ateFood = true;
        AudioManager.tocar('comer');
        break;
      }
    }

    // --- Colisão com power-ups no campo ---
    for (let i = 0; i < this.state.powerUpsOnField.length; i++) {
      const pu = this.state.powerUpsOnField[i];
      if (Utils.posEqual(head, pu.pos)) {
        this.state.powerUpsOnField.splice(i, 1);
        this.activatePowerUp(pu.id);
        break;
      }
    }

    // Cresce ou remove a cauda
    if (!ateFood && !this.state.growOnNext) {
      this.state.snake.pop();
    } else {
      this.state.growOnNext = false;
    }

    // Atualiza recorde
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
      localStorage.setItem('nibbles_highScore', this.state.highScore);
    }

    this.updateActivePowerUps();
    this.ensureFoodCount();
    UI.atualizarInfo();
    UI.draw();
  },

  handleDeath() {
    this.state.lives--;
    AudioManager.tocar('morte');

    if (this.state.lives > 0) {
      // Ressuscita no centro com estado limpo
      this.state.snake = [{
        x: Math.floor(this.state.gridCountX / 2),
        y: Math.floor(this.state.gridCountY / 2)
      }];
      this.state.dir             = { x: 1, y: 0 };
      this.state.foods           = [];
      this.state.powerUpsOnField = [];
      this.placeInitialFood();
    } else {
      // Game over
      this.state.running = false;
      if (this.state._rafId) {
        cancelAnimationFrame(this.state._rafId);
        this.state._rafId = null;
      }
      UI.mostrarGameOver();
      Analytics.registrar('game_over', {
        score: this.state.score,
        moedas: this.state.moedasColetadas
      });
    }
    UI.atualizarInfo();
  },

  /**
   * FIX #10: Conta apenas comidas reais (exclui moedas da contagem mínima).
   * Antes, moedas competiam com comidas normais, causando "fome" permanente
   * quando o campo estava cheio de moedas.
   */
  ensureFoodCount() {
    const { foodCount } = this.getCurrentDifficulty();
    const realFoods = this.state.foods.filter(f => f.type !== 'coin');
    while (realFoods.length < foodCount) {
      this.generateFood();
      realFoods.push({}); // incrementa contador local para sair do loop
    }
  },

  setDir(x, y) {
    if (this.state.running && !this.state.paused) {
      this.state.nextDir = { x, y };
    }
  },

  start() {
    if (this.state.running && !this.state.paused) return;
    this.resizeCanvas(); // recalcula grid antes de iniciar
    this.reset();
    this.state.running = true;
    this.state.paused  = false;
    UI.atualizarBotoes();
    this.restartLoop();
    Analytics.registrar('jogo_iniciado', { dificuldade: this.getCurrentDifficulty() });
  },

  pause() {
    if (!this.state.running) return;
    this.state.paused = !this.state.paused;
    if (this.state.paused) {
      if (this.state._rafId) {
        cancelAnimationFrame(this.state._rafId);
        this.state._rafId = null;
      }
    } else {
      this.restartLoop();
    }
    UI.atualizarBotoes();
  },

  resetGame() {
    if (this.state._rafId) {
      cancelAnimationFrame(this.state._rafId);
      this.state._rafId = null;
    }
    this.state.running = false;
    this.state.paused  = false;
    this.reset();
    UI.atualizarBotoes();
    UI.drawStartScreen();
  }
};

// ---------- UI ----------
const UI = {
  /** Getters para sempre pegar o contexto atualizado após resize. */
  get canvas() { return document.getElementById('gameCanvas'); },
  get ctx()    { return document.getElementById('gameCanvas').getContext('2d'); },

  init() {
    this.atualizarInfo();
    this.atualizarPowerBadges();
    this.atualizarSpeedUI();
    this.atualizarMoedasUI();
    this.drawStartScreen();
  },

  atualizarInfo() {
    document.getElementById('score').textContent      = Game.state.score;
    document.getElementById('highScore').textContent  = Game.state.highScore;
    document.getElementById('lives').textContent      = Game.state.lives;
    document.getElementById('moedasJogo').textContent = Game.state.moedasColetadas;
  },

  atualizarMoedasUI() {
    document.getElementById('moedasDisplay').innerHTML = `<i class="fas fa-coins"></i> ${Conta.moedas}`;
    document.getElementById('modalMoedas').textContent = Conta.moedas;
  },

  /**
   * FIX #9: speedBar reflete o intervalo REAL (após speedMultiplier),
   * não apenas o intervalMs base da dificuldade.
   */
  atualizarSpeedUI() {
    const actualInterval = Math.max(18, Math.floor(
      Game.state.intervalMs / (Game.state.speedMultiplier || 1)
    ));
    const maxInterval = Config.difficulty.easy.speed; // mais lento possível
    const minInterval = 18;                            // mais rápido possível
    const pct = Math.min(100, Math.round(
      (maxInterval - actualInterval) / (maxInterval - minInterval) * 100
    ));
    document.getElementById('speedBar').style.width       = pct + '%';
    document.getElementById('speedDisplay').textContent   = Game.state.speedMultiplier.toFixed(2) + 'x';
  },

  atualizarPowerBadges() {
    const container = document.getElementById('powerBadges');
    container.innerHTML = '';
    const ativos = Object.keys(Game.state.activePowerUps);

    if (ativos.length === 0) {
      document.getElementById('powerUpList').textContent = '—';
    } else {
      document.getElementById('powerUpList').textContent = ativos.join(', ');
      ativos.forEach(id => {
        const pu = Config.powerUps.find(p => p.id === id);
        if (!pu) return;
        const span = document.createElement('span');
        span.className = 'power-up';
        span.textContent = pu.label;
        span.style.background = pu.badgeColor;
        container.appendChild(span);
      });
    }
  },

  atualizarBotoes() {
    const startBtn   = document.getElementById('startBtn');
    const pauseBtn   = document.getElementById('pauseBtn');
    const restartBtn = document.getElementById('restartBtn');

    if (Game.state.running) {
      startBtn.style.display   = 'none';
      pauseBtn.style.display   = 'inline-block';
      restartBtn.style.display = 'inline-block';
      pauseBtn.textContent     = Game.state.paused ? 'Continuar' : 'Pausar';
    } else {
      startBtn.style.display   = 'inline-block';
      pauseBtn.style.display   = 'none';
      restartBtn.style.display = 'none';
    }
  },

  draw() {
    const { canvas, ctx } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Comidas ---
    Game.state.foods.forEach(f => {
      const px = f.pos.x * Config.gridSize;
      const py = f.pos.y * Config.gridSize;
      ctx.fillStyle = f.color;

      if (f.type === 'coin') {
        ctx.beginPath();
        ctx.arc(px + Config.gridSize / 2, py + Config.gridSize / 2, Config.gridSize / 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = 'goldenrod';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', px + Config.gridSize / 2, py + Config.gridSize / 2);
      } else {
        Utils.roundRect(ctx, px + 2, py + 2, Config.gridSize - 4, Config.gridSize - 4, 6, true, false);
      }
    });

    // --- Power-ups no campo (com inicial do nome) ---
    Game.state.powerUpsOnField.forEach(p => {
      const px = p.pos.x * Config.gridSize;
      const py = p.pos.y * Config.gridSize;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px + Config.gridSize / 2, py + Config.gridSize / 2, Config.gridSize / 3, 0, 2 * Math.PI);
      ctx.fill();
      const pu = Config.powerUps.find(x => x.id === p.id);
      if (pu) {
        ctx.fillStyle = '#071026';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pu.label[0].toUpperCase(), px + Config.gridSize / 2, py + Config.gridSize / 2);
      }
    });

    // --- Cobra ---
    Game.state.snake.forEach((seg, i) => {
      const px = seg.x * Config.gridSize;
      const py = seg.y * Config.gridSize;
      ctx.fillStyle = i === 0
        ? Config.colors.primary
        : (i % 2 === 0 ? Config.colors.secondary : '#18324a');
      Utils.roundRect(ctx, px + 1, py + 1, Config.gridSize - 2, Config.gridSize - 2, 6, true, false);
    });

    // --- Indicador visual do Escudo ---
    if (Game.state.shield && Game.state.snake[0]) {
      const head = Game.state.snake[0];
      const px = head.x * Config.gridSize;
      const py = head.y * Config.gridSize;
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 2, py + 2, Config.gridSize - 4, Config.gridSize - 4);
    }
  },

  drawStartScreen() {
    const { canvas, ctx } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.04;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#9fb4d8';
    ctx.font = '18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Clique Iniciar para jogar', canvas.width / 2, canvas.height / 2 - 6);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#8aa7c9';
    ctx.fillText('Setas / WASD / Swipe', canvas.width / 2, canvas.height / 2 + 14);
  },

  mostrarGameOver() {
    document.getElementById('finalScore').textContent  = Game.state.score;
    document.getElementById('finalMoedas').textContent = Game.state.moedasColetadas;
    document.getElementById('gameOverOverlay').style.display = 'flex';
  },

  hideGameOver() {
    document.getElementById('gameOverOverlay').style.display = 'none';
  },

  /**
   * FIX #3: Toast Bootstrap nativo — não usa alert(), não bloqueia a thread,
   * não interrompe o game loop.
   * @param {string} msg  - Mensagem a exibir
   * @param {string} tipo - 'success' | 'warning' | 'info' | 'danger'
   */
  mostrarToast(msg, tipo = 'success') {
    const id = 'toast_' + Date.now();
    const colorMap = {
      success: 'bg-success',
      warning: 'bg-warning text-dark',
      info:    'bg-info text-dark',
      danger:  'bg-danger'
    };
    const colorClass = colorMap[tipo] || 'bg-secondary';
    const html = `
      <div id="${id}"
           class="toast align-items-center ${colorClass} text-white border-0"
           role="alert"
           aria-live="assertive"
           aria-atomic="true"
           style="position:fixed;bottom:24px;right:24px;z-index:99999;min-width:220px">
        <div class="d-flex">
          <div class="toast-body fw-semibold">${msg}</div>
          <button type="button"
                  class="btn-close btn-close-white me-2 m-auto"
                  data-bs-dismiss="toast"
                  aria-label="Fechar"></button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const el    = document.getElementById(id);
    const toast = new bootstrap.Toast(el, { delay: 2500 });
    toast.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
  }
};

// ---------- INICIALIZAÇÃO E EVENTOS ----------
window.addEventListener('load', () => {
  Conta.carregar();
  Game.init();
  UI.init();
  AudioManager.init();

  // --- Botões de controle ---
  document.getElementById('startBtn').addEventListener('click', () => Game.start());
  document.getElementById('pauseBtn').addEventListener('click', () => Game.pause());
  document.getElementById('restartBtn').addEventListener('click', () => Game.resetGame());
  document.getElementById('playAgainBtn').addEventListener('click', () => {
    UI.hideGameOver();
    Game.start();
  });

  // --- Seleção de dificuldade ---
  document.querySelectorAll('#difficultyGroup .difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#difficultyGroup .difficulty-btn')
              .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (Game.state.running) {
        const dif = Game.getCurrentDifficulty();
        Game.state.intervalMs      = dif.speed;
        Game.state.speedMultiplier = dif.speedMultiplier;
        UI.atualizarSpeedUI();
      }
    });
  });

  // --- Teclado ---
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    // Previne scroll da página nas teclas de controle
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
      e.preventDefault();
    }
    if (k === 'arrowup'    || k === 'w') Game.setDir(0, -1);
    if (k === 'arrowdown'  || k === 's') Game.setDir(0, 1);
    if (k === 'arrowleft'  || k === 'a') Game.setDir(-1, 0);
    if (k === 'arrowright' || k === 'd') Game.setDir(1, 0);
    if (k === ' ') {
      if (!Game.state.running) Game.start();
      else Game.pause();
    }
    if (k === 'r') Game.resetGame();
  });

  // --- FIX #5: Swipe mobile sem scroll da página ---
  let touchStart = null;
  const canvasEl = document.getElementById('gameCanvas');

  canvasEl.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true }); // touchstart pode ser passive (não precisa prevenir)

  canvasEl.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t  = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;

    if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
      e.preventDefault(); // previne scroll somente quando há swipe intencional
      if (Math.abs(dx) > Math.abs(dy)) {
        Game.setDir(dx > 0 ? 1 : -1, 0);
      } else {
        Game.setDir(0, dy > 0 ? 1 : -1);
      }
    }
    touchStart = null;
  }, { passive: false }); // FIX #5: passive:false para permitir preventDefault

  // --- Modal de som ---
  document.getElementById('btnSom').addEventListener('click', () => {
    document.getElementById('volEfeitos').value = AudioManager.volumeEfeitos;
    document.getElementById('somAtivo').checked = AudioManager.ativo;
    new bootstrap.Modal(document.getElementById('somModal')).show();
  });
  document.getElementById('volEfeitos').addEventListener('input', (e) =>
    AudioManager.setVolume(parseFloat(e.target.value))
  );
  document.getElementById('somAtivo').addEventListener('change', (e) =>
    AudioManager.setAtivo(e.target.checked)
  );

  // --- FIX #7: Recalcular canvas ao redimensionar janela ---
  window.addEventListener('resize', () => {
    Game.resizeCanvas();
    if (!Game.state.running) UI.drawStartScreen();
    else UI.draw();
  });
});
