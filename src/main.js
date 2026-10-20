import * as THREE from 'three';
import { Player } from './player.js';
import { EnemyManager } from './enemies.js';
import { FXManager } from './effects.js';
import { CollectibleManager } from './collectibles.js';
import { sounds } from './audio.js';

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // Game state
    this.state = 'MENU'; // 'MENU' | 'PLAYING' | 'GAMEOVER'
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('astro_high_score') || '0', 10);
    this.enemiesDestroyed = 0;
    this.wave = 1;
    this.waveScoreTarget = 1500;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;

    // Controls input state
    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      fire: false,
      boost: false,
    };

    this.mouse = { x: 0, y: 0, isDown: false };

    // Delta tracking
    this.lastTime = performance.now();

    this.initThree();
    this.initEntities();
    this.bindEvents();
    this.updateHUD();

    // Start render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030611, 0.0035);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.cameraDefaultPos = new THREE.Vector3(0, 7, 24);
    this.camera.position.copy(this.cameraDefaultPos);
    this.camera.lookAt(0, 0, -50);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0x1a2638, 1.8);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xddeeff, 2.8);
    sunLight.position.set(40, 60, 30);
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x00f3ff, 1.4);
    rimLight.position.set(-30, -20, -50);
    this.scene.add(rimLight);
  }

  initEntities() {
    this.fx = new FXManager(this.scene);
    this.player = new Player(this.scene);
    this.enemyManager = new EnemyManager(this.scene, this.fx);
    this.collectibles = new CollectibleManager(this.scene);
  }

  bindEvents() {
    // Keyboard
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Mouse
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.state === 'PLAYING') {
        this.input.fire = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.input.fire = false;
      }
    });

    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // UI Buttons
    document.getElementById('start-btn').addEventListener('click', () => {
      sounds.init();
      this.startGame();
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      sounds.init();
      this.startGame();
    });

    // Mute button
    const muteBtn = document.getElementById('mute-btn');
    muteBtn.addEventListener('click', () => {
      sounds.init();
      const isMuted = sounds.toggleMute();
      muteBtn.textContent = isMuted ? '🔇' : '🔊';
    });

    // Fullscreen button
    const fsBtn = document.getElementById('fs-btn');
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // PWA & Service Worker
    this.setupPWA();

    // Mobile Virtual Joystick & Buttons
    this.setupTouchControls();
  }

  setupPWA() {
    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered successfully:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    // 2. Handle install prompt
    let deferredPrompt = null;
    const hudInstallBtn = document.getElementById('install-btn');
    const modalInstallBtn = document.getElementById('modal-install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (hudInstallBtn) hudInstallBtn.style.display = 'inline-flex';
      if (modalInstallBtn) modalInstallBtn.style.display = 'block';
    });

    const triggerInstall = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] User install choice: ${outcome}`);
      deferredPrompt = null;
      if (hudInstallBtn) hudInstallBtn.style.display = 'none';
      if (modalInstallBtn) modalInstallBtn.style.display = 'none';
    };

    if (hudInstallBtn) hudInstallBtn.addEventListener('click', triggerInstall);
    if (modalInstallBtn) modalInstallBtn.addEventListener('click', triggerInstall);

    window.addEventListener('appinstalled', () => {
      this.showToast('🚀 APP BERHASIL DIPASANG! SIAP DIMAINKAN OFFLINE');
      if (hudInstallBtn) hudInstallBtn.style.display = 'none';
      if (modalInstallBtn) modalInstallBtn.style.display = 'none';
    });

    // 3. Online/Offline network monitoring
    window.addEventListener('offline', () => {
      this.showToast('📡 MODE OFFLINE AKTIF - PERMAINAN TETAP BERJALAN');
    });
    window.addEventListener('online', () => {
      this.showToast('🌐 TERHUBUNG KEMBALI KE INTERNET');
    });
  }

  setupTouchControls() {
    const stickZone = document.getElementById('touch-stick-zone');
    const stick = document.getElementById('touch-stick');
    const btnFire = document.getElementById('btn-touch-fire');
    const btnEmp = document.getElementById('btn-touch-emp');

    let touchId = null;
    let startX = 0;
    let startY = 0;

    stickZone.addEventListener('touchstart', (e) => {
      sounds.init();
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      const rect = stickZone.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (touchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchId) {
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;
          const maxRadius = 45;
          const dist = Math.min(Math.hypot(dx, dy), maxRadius);
          const angle = Math.atan2(dy, dx);
          const px = Math.cos(angle) * dist;
          const py = Math.sin(angle) * dist;

          stick.style.transform = `translate(${px}px, ${py}px)`;

          this.input.left = px < -12;
          this.input.right = px > 12;
          this.input.up = py < -12;
          this.input.down = py > 12;
        }
      }
    }, { passive: true });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          touchId = null;
          stick.style.transform = 'translate(0, 0)';
          this.input.left = false;
          this.input.right = false;
          this.input.up = false;
          this.input.down = false;
        }
      }
    };

    window.addEventListener('touchend', endTouch, { passive: true });
    window.addEventListener('touchcancel', endTouch, { passive: true });

    btnFire.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sounds.init();
      this.input.fire = true;
    });
    btnFire.addEventListener('touchend', () => {
      this.input.fire = false;
    });

    btnEmp.addEventListener('touchstart', (e) => {
      e.preventDefault();
      sounds.init();
      this.triggerEMP();
    });
  }

  onKeyDown(e) {
    sounds.init();
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.up = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.down = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = true;
        break;
      case 'Space':
        this.input.fire = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.boost = true;
        break;
      case 'KeyE':
      case 'KeyB':
      case 'KeyQ':
        this.triggerEMP();
        break;
    }
  }

  onKeyUp(e) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.up = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.down = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = false;
        break;
      case 'Space':
        this.input.fire = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.boost = false;
        break;
    }
  }

  startGame() {
    this.state = 'PLAYING';
    this.score = 0;
    this.enemiesDestroyed = 0;
    this.wave = 1;
    this.waveScoreTarget = 1500;
    this.combo = 1;
    this.comboTimer = 0;

    this.player.reset();
    this.enemyManager.reset();
    this.collectibles.reset();

    document.getElementById('start-overlay').style.display = 'none';
    document.getElementById('gameover-overlay').style.display = 'none';
    document.getElementById('boss-bar-wrap').style.display = 'none';

    this.showToast('🚀 MISSION COMMENCED! GOOD LUCK COMMANDER!');
    this.updateHUD();
  }

  gameOver() {
    this.state = 'GAMEOVER';
    sounds.playExplosion(true);
    this.fx.createExplosion(this.player.mesh.position.x, this.player.mesh.position.y, this.player.mesh.position.z, 0x00f3ff, 60, 2.5);
    this.fx.triggerScreenShake(3.0);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('astro_high_score', this.highScore.toString());
    }

    document.getElementById('stat-score').textContent = this.score.toLocaleString();
    document.getElementById('stat-high').textContent = this.highScore.toLocaleString();
    document.getElementById('stat-kills').textContent = this.enemiesDestroyed.toString();
    document.getElementById('stat-combo').textContent = `x${this.maxCombo}`;

    setTimeout(() => {
      document.getElementById('gameover-overlay').style.display = 'flex';
    }, 700);
  }

  triggerEMP() {
    if (this.state !== 'PLAYING') return;
    if (this.player.empCount <= 0) {
      this.showToast('⚠️ NO EMP BOMBS REMAINING!');
      return;
    }

    this.player.empCount--;
    sounds.playEMP();
    this.fx.createEMPWave(this.player.mesh.position.x, this.player.mesh.position.y, this.player.mesh.position.z);
    const scoreEarned = this.enemyManager.wipeAllEnemiesEMP();
    if (scoreEarned > 0) {
      this.addScore(scoreEarned);
    }
    this.showToast('💥 EMP DETONATED! SECTOR CLEARED!');
    this.updateHUD();
  }

  addScore(baseAmount) {
    const gained = baseAmount * this.combo;
    this.score += gained;

    // Refresh combo
    this.combo = Math.min(5, this.combo + 1);
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboTimer = 2.8; // 2.8 seconds combo window

    // Check wave milestone
    if (this.score >= this.waveScoreTarget * this.wave) {
      this.wave++;
      this.enemyManager.difficultyMultiplier = 1.0 + (this.wave - 1) * 0.4;
      this.showToast(`🚨 WAVE ${this.wave} REACHED! ENEMY THREAT INCREASED!`);

      // Spawn Boss every 2 waves
      if (this.wave % 2 === 0 && !this.enemyManager.activeBoss) {
        this.enemyManager.spawnBoss(this.wave / 2);
        this.showToast('⚠️ ALERT: CAPITAL MOTHERSHIP DETECTED!');
      }
    }

    this.updateHUD();
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  updateHUD() {
    // Shield
    const shieldPct = Math.round((this.player.shield / this.player.maxShield) * 100);
    document.getElementById('shield-val').textContent = `${shieldPct}%`;
    document.getElementById('shield-bar').style.width = `${shieldPct}%`;

    // Hull HP
    const hullPct = Math.round((this.player.hp / this.player.maxHp) * 100);
    document.getElementById('hull-val').textContent = `${hullPct}%`;
    document.getElementById('hull-bar').style.width = `${hullPct}%`;

    // EMP Icons
    const empContainer = document.getElementById('emp-icons-container');
    empContainer.innerHTML = '';
    for (let i = 0; i < this.player.empCount; i++) {
      const icon = document.createElement('span');
      icon.className = 'emp-icon';
      empContainer.appendChild(icon);
    }

    // Score
    document.getElementById('score-display').textContent = this.score.toString().padStart(5, '0');

    // Combo
    const comboBadge = document.getElementById('combo-badge');
    if (this.combo > 1) {
      comboBadge.textContent = `COMBO x${this.combo}`;
      comboBadge.classList.add('active');
    } else {
      comboBadge.classList.remove('active');
    }

    // Wave
    document.getElementById('wave-display').textContent = `WAVE ${this.wave}`;

    // Boss Bar
    const bossWrap = document.getElementById('boss-bar-wrap');
    if (this.enemyManager.activeBoss) {
      bossWrap.style.display = 'flex';
      const boss = this.enemyManager.activeBoss;
      const bPct = Math.max(0, Math.round((boss.hp / boss.maxHp) * 100));
      document.getElementById('boss-hp-val').textContent = `${bPct}%`;
      document.getElementById('boss-bar-fill').style.width = `${bPct}%`;
    } else {
      bossWrap.style.display = 'none';
    }
  }

  checkCollisions() {
    // 1. Player Lasers vs Enemies
    const lasers = this.player.lasers;
    const enemies = this.enemyManager.enemies;

    for (let i = lasers.length - 1; i >= 0; i--) {
      const laser = lasers[i];
      let laserHit = false;

      // Check vs normal enemies
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        const dist = laser.mesh.position.distanceTo(enemy.mesh.position);
        if (dist < enemy.radius + 1.2) {
          enemy.hp -= laser.damage;
          laserHit = true;
          this.fx.createExplosion(laser.mesh.position.x, laser.mesh.position.y, laser.mesh.position.z, 0x00f3ff, 8, 0.4);

          if (enemy.hp <= 0) {
            sounds.playExplosion(enemy.type === 'cruiser');
            this.fx.createExplosion(
              enemy.mesh.position.x,
              enemy.mesh.position.y,
              enemy.mesh.position.z,
              enemy.type === 'cruiser' ? 0x9d4edd : 0xff3344,
              enemy.type === 'cruiser' ? 35 : 22,
              enemy.type === 'cruiser' ? 1.4 : 1.0
            );
            this.addScore(enemy.scoreValue);
            this.enemiesDestroyed++;
            this.collectibles.maybeDrop(enemy.mesh.position.x, enemy.mesh.position.y, enemy.mesh.position.z, 0.35);

            this.scene.remove(enemy.mesh);
            enemies.splice(j, 1);
          }
          break;
        }
      }

      // Check vs Asteroids
      if (!laserHit) {
        const asteroids = this.enemyManager.asteroids;
        for (let k = asteroids.length - 1; k >= 0; k--) {
          const ast = asteroids[k];
          const dist = laser.mesh.position.distanceTo(ast.mesh.position);
          if (dist < ast.radius + 1.0) {
            ast.hp -= laser.damage;
            laserHit = true;
            this.fx.createExplosion(laser.mesh.position.x, laser.mesh.position.y, laser.mesh.position.z, 0xaaaaaa, 10, 0.5);

            if (ast.hp <= 0) {
              sounds.playExplosion(false);
              this.fx.createExplosion(ast.mesh.position.x, ast.mesh.position.y, ast.mesh.position.z, 0x887766, 25, ast.scale);
              this.addScore(ast.scoreValue);
              this.collectibles.maybeDrop(ast.mesh.position.x, ast.mesh.position.y, ast.mesh.position.z, 0.2);

              this.scene.remove(ast.mesh);
              asteroids.splice(k, 1);
            }
            break;
          }
        }
      }

      // Check vs Boss
      if (!laserHit && this.enemyManager.activeBoss) {
        const boss = this.enemyManager.activeBoss;
        const dist = laser.mesh.position.distanceTo(boss.mesh.position);
        if (dist < boss.radius) {
          boss.hp -= laser.damage;
          laserHit = true;
          this.fx.createExplosion(laser.mesh.position.x, laser.mesh.position.y, laser.mesh.position.z, 0xff0055, 12, 0.6);

          if (boss.hp <= 0) {
            sounds.playExplosion(true);
            this.fx.createExplosion(boss.mesh.position.x, boss.mesh.position.y, boss.mesh.position.z, 0xff0055, 80, 3.5);
            this.fx.triggerScreenShake(3.5);
            this.addScore(boss.scoreValue);
            this.enemiesDestroyed += 5;
            this.showToast('🏆 CAPITAL MOTHERSHIP ANNIHILATED! +2500 PTS');

            // Drop guaranteed powerups
            this.collectibles.spawnPowerup(boss.mesh.position.x - 4, boss.mesh.position.y, boss.mesh.position.z, 'emp');
            this.collectibles.spawnPowerup(boss.mesh.position.x + 4, boss.mesh.position.y, boss.mesh.position.z, 'weapon');

            this.scene.remove(boss.mesh);
            this.enemyManager.activeBoss = null;
          }
        }
      }

      if (laserHit) {
        this.scene.remove(laser.mesh);
        laser.mesh.geometry.dispose();
        laser.mesh.material.dispose();
        lasers.splice(i, 1);
      }
    }

    // 2. Enemy Lasers vs Player
    const eLasers = this.enemyManager.enemyLasers;
    for (let i = eLasers.length - 1; i >= 0; i--) {
      const el = eLasers[i];
      const dist = el.mesh.position.distanceTo(this.player.mesh.position);
      if (dist < 3.2) {
        const dead = this.player.takeDamage(el.damage);
        this.fx.createExplosion(el.mesh.position.x, el.mesh.position.y, el.mesh.position.z, 0xff0044, 15, 0.8);
        this.fx.triggerScreenShake(0.8);
        this.updateHUD();

        this.scene.remove(el.mesh);
        eLasers.splice(i, 1);

        if (dead) {
          this.gameOver();
          return;
        }
      }
    }

    // 3. Player Physical Collision vs Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const dist = e.mesh.position.distanceTo(this.player.mesh.position);
      if (dist < e.radius + 2.5) {
        const dead = this.player.takeDamage(35);
        this.fx.createExplosion(e.mesh.position.x, e.mesh.position.y, e.mesh.position.z, 0xff5500, 30, 1.2);
        this.fx.triggerScreenShake(1.5);
        this.updateHUD();

        this.scene.remove(e.mesh);
        enemies.splice(i, 1);

        if (dead) {
          this.gameOver();
          return;
        }
      }
    }

    // 4. Player Physical Collision vs Asteroids
    const asteroids = this.enemyManager.asteroids;
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const ast = asteroids[i];
      const dist = ast.mesh.position.distanceTo(this.player.mesh.position);
      if (dist < ast.radius + 2.5) {
        const dead = this.player.takeDamage(25 * ast.scale);
        this.fx.createExplosion(ast.mesh.position.x, ast.mesh.position.y, ast.mesh.position.z, 0x887766, 25, ast.scale);
        this.fx.triggerScreenShake(1.3);
        this.updateHUD();

        this.scene.remove(ast.mesh);
        asteroids.splice(i, 1);

        if (dead) {
          this.gameOver();
          return;
        }
      }
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Dynamic Camera Follow & Shake
    const shake = this.fx.getShakeOffset();
    const targetCamX = this.player.mesh.position.x * 0.45 + shake.x;
    const targetCamY = 7 + this.player.mesh.position.y * 0.35 + shake.y;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, 0.1);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, 0.1);
    this.camera.lookAt(
      this.player.mesh.position.x * 0.25,
      this.player.mesh.position.y * 0.25,
      -60
    );

    // Update crosshair in HUD
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      const screenX = ((this.player.mesh.position.x / 42) * 0.4 + 0.5) * window.innerWidth;
      const screenY = ((-this.player.mesh.position.y / 24) * 0.4 + 0.5) * window.innerHeight;
      crosshair.style.transform = `translate(${screenX - 22}px, ${screenY - 22}px)`;
    }

    // Combo Timer Decay
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.updateHUD();
      }
    }

    const warpSpeed = this.input.boost ? 2.2 : 1.0;
    this.fx.update(delta, warpSpeed);

    if (this.state === 'PLAYING') {
      this.player.update(delta, this.input);
      this.enemyManager.update(delta, this.player.mesh.position);
      this.collectibles.update(delta, this.player, (type) => {
        const names = {
          weapon: '⚡ WEAPON UPGRADE: HIGH-ENERGY CANNONS!',
          shield: '🛡️ SHIELD RECHARGED +60%!',
          repair: '💚 NANO REPAIR ACTIVATED +40 HP!',
          emp: '💣 EMP SUPERWEAPON STOCK ACQUIRED!',
        };
        this.showToast(names[type] || 'BONUS COLLECTED!');
        this.updateHUD();
      });

      this.checkCollisions();
      this.updateHUD();
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate game on load
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
