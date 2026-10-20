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

    this.autoFire = true;

    // Controls input state
    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      fire: false,
      boost: false,
      analogX: 0,
      analogY: 0,
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

  updateCameraAspect() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    this.camera.aspect = aspect;

    // Responsive adaptation:
    // If aspect < 1.0 (Mobile portrait), increase FOV and elevate camera
    // to give a generous, comfortable view of deep space without cramping!
    if (aspect < 1.0) {
      this.camera.fov = 66;
      this.cameraDefaultPos.set(0, 10, 32);
    } else {
      this.camera.fov = 54;
      this.cameraDefaultPos.set(0, 7, 24);
    }

    this.camera.updateProjectionMatrix();
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030611, 0.0035);

    // 2. Camera with adaptive mobile framing
    this.cameraDefaultPos = new THREE.Vector3(0, 7, 24);
    this.camera = new THREE.PerspectiveCamera(
      54,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.copy(this.cameraDefaultPos);
    this.camera.lookAt(0, 0, -50);
    this.updateCameraAspect();

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
      this.updateCameraAspect();
    });

    // Helper for immediate touch/click response without delay
    const addTapListener = (el, callback) => {
      if (!el) return;
      let handled = false;
      el.addEventListener('pointerdown', (e) => {
        handled = true;
        callback(e);
      });
      el.addEventListener('click', (e) => {
        if (handled) {
          handled = false;
          return;
        }
        callback(e);
      });
    };

    // UI Buttons
    addTapListener(document.getElementById('start-btn'), () => {
      sounds.init();
      this.startGame();
    });

    addTapListener(document.getElementById('restart-btn'), () => {
      sounds.init();
      this.startGame();
    });

    // Mute button
    const muteBtn = document.getElementById('mute-btn');
    addTapListener(muteBtn, () => {
      sounds.init();
      const isMuted = sounds.toggleMute();
      muteBtn.textContent = isMuted ? '🔇' : '🔊';
    });

    // Fullscreen button
    const fsBtn = document.getElementById('fs-btn');
    addTapListener(fsBtn, () => {
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
    const moveArea = document.getElementById('touch-move-area');
    const joystick = document.getElementById('dynamic-joystick');
    const knob = document.getElementById('dynamic-stick-knob');
    const btnFire = document.getElementById('btn-touch-fire');
    const btnEmp = document.getElementById('btn-touch-emp');
    const btnAutoFire = document.getElementById('btn-touch-autofire');

    // Auto Fire Toggle
    if (btnAutoFire) {
      const toggleAutoFire = (e) => {
        if (e) e.stopPropagation();
        this.autoFire = !this.autoFire;
        if (this.autoFire) {
          btnAutoFire.classList.add('active');
          btnAutoFire.innerHTML = 'AUTO<br>ON';
          this.showToast('🎯 AUTO-FIRE: ON');
        } else {
          btnAutoFire.classList.remove('active');
          btnAutoFire.innerHTML = 'AUTO<br>OFF';
          this.input.fire = false;
          this.showToast('🎯 AUTO-FIRE: OFF');
        }
      };
      btnAutoFire.addEventListener('pointerdown', toggleAutoFire);
      btnAutoFire.addEventListener('click', toggleAutoFire);
    }

    let touchId = null;
    let startX = 0;
    let startY = 0;
    const maxRadius = 45;

    if (moveArea) {
      moveArea.addEventListener('touchstart', (e) => {
        sounds.init();
        if (touchId !== null) return;
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        startX = touch.clientX;
        startY = touch.clientY;

        if (joystick) {
          joystick.style.left = `${startX}px`;
          joystick.style.top = `${startY}px`;
          joystick.style.display = 'block';
          if (knob) knob.style.transform = 'translate(0px, 0px)';
        }
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (touchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === touchId) {
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            const dist = Math.hypot(dx, dy);

            // Dynamic following joystick:
            // When thumb drags past maxRadius, glide joystick base with it so you NEVER run out of analog range!
            if (dist > maxRadius) {
              const excess = dist - maxRadius;
              const angle = Math.atan2(dy, dx);
              startX += Math.cos(angle) * excess;
              startY += Math.sin(angle) * excess;
              if (joystick) {
                joystick.style.left = `${startX}px`;
                joystick.style.top = `${startY}px`;
              }
            }

            const currentDx = touch.clientX - startX;
            const currentDy = touch.clientY - startY;
            const currentDist = Math.hypot(currentDx, currentDy);
            const clampedDist = Math.min(currentDist, maxRadius);
            const angle = Math.atan2(currentDy, currentDx);
            const px = Math.cos(angle) * clampedDist;
            const py = Math.sin(angle) * clampedDist;

            if (knob) knob.style.transform = `translate(${px}px, ${py}px)`;

            // Smooth analog output [-1.0, 1.0] with 4px deadzone
            const deadZone = 4;
            if (currentDist > deadZone) {
              const norm = Math.min((currentDist - deadZone) / (maxRadius - deadZone), 1.0);
              this.input.analogX = Math.cos(angle) * norm;
              this.input.analogY = -Math.sin(angle) * norm; // Screen Y is inverted from 3D space
            } else {
              this.input.analogX = 0;
              this.input.analogY = 0;
            }

            this.input.left = px < -8;
            this.input.right = px > 8;
            this.input.up = py < -8;
            this.input.down = py > 8;
          }
        }
      }, { passive: true });

      const endTouch = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchId) {
            touchId = null;
            if (joystick) joystick.style.display = 'none';
            if (knob) knob.style.transform = 'translate(0px, 0px)';
            this.input.analogX = 0;
            this.input.analogY = 0;
            this.input.left = false;
            this.input.right = false;
            this.input.up = false;
            this.input.down = false;
          }
        }
      };

      window.addEventListener('touchend', endTouch, { passive: true });
      window.addEventListener('touchcancel', endTouch, { passive: true });
    }

    if (btnFire) {
      btnFire.addEventListener('touchstart', (e) => {
        e.preventDefault();
        sounds.init();
        this.input.fire = true;
      });
      btnFire.addEventListener('touchend', () => {
        if (!this.autoFire) {
          this.input.fire = false;
        }
      });
    }

    if (btnEmp) {
      btnEmp.addEventListener('touchstart', (e) => {
        e.preventDefault();
        sounds.init();
        this.triggerEMP();
      });
    }
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

    // Dynamic Camera Follow & Shake (smooth and adaptive to aspect ratio)
    const shake = this.fx.getShakeOffset();
    const targetCamX = this.player.mesh.position.x * 0.35 + shake.x;
    const defaultY = this.cameraDefaultPos ? this.cameraDefaultPos.y : 7;
    const targetCamY = defaultY + this.player.mesh.position.y * 0.25 + shake.y;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, 0.12);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, 0.12);
    this.camera.lookAt(
      this.player.mesh.position.x * 0.2,
      this.player.mesh.position.y * 0.2,
      -60
    );

    // Update crosshair in HUD (bounded smoothly to active player bounds)
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      const boundX = this.player.bounds ? this.player.bounds.maxX : 25;
      const boundY = this.player.bounds ? this.player.bounds.maxY : 18;
      const screenX = ((this.player.mesh.position.x / boundX) * 0.42 + 0.5) * window.innerWidth;
      const screenY = ((-this.player.mesh.position.y / boundY) * 0.42 + 0.5) * window.innerHeight;
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
      if (this.autoFire) {
        this.input.fire = true;
      }
      this.player.update(delta, this.input, this.camera);
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

// Safe instantiation supporting PWA standalone and normal browser load
function launchGame() {
  if (!window.__astroGameInstance) {
    window.__astroGameInstance = new Game();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', launchGame);
} else {
  launchGame();
}
