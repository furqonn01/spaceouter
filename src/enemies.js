import * as THREE from 'three';
import { sounds } from './audio.js';

export class EnemyManager {
  constructor(scene, fxManager) {
    this.scene = scene;
    this.fx = fxManager;
    this.enemies = [];
    this.enemyLasers = [];
    this.asteroids = [];

    // Wave control
    this.spawnTimer = 0;
    this.asteroidTimer = 0;
    this.difficultyMultiplier = 1.0;
    this.activeBoss = null;

    // Shared geometries and materials for performance
    this.initGeometries();
  }

  initGeometries() {
    // Scout Drone Geometry (stealth interceptor)
    const droneShape = new THREE.ConeGeometry(1.6, 3.8, 4);
    droneShape.rotateX(-Math.PI / 2);
    this.droneGeo = droneShape;
    this.droneMat = new THREE.MeshStandardMaterial({
      color: 0xff3344,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x880011,
      emissiveIntensity: 0.3,
    });

    // Heavy Cruiser Geometry
    this.cruiserGeo = new THREE.BoxGeometry(4.2, 1.8, 6.5);
    this.cruiserMat = new THREE.MeshStandardMaterial({
      color: 0x6a1b9a,
      roughness: 0.4,
      metalness: 0.7,
      emissive: 0x38006b,
      emissiveIntensity: 0.4,
    });

    // Asteroid base geometry
    this.asteroidGeo = new THREE.DodecahedronGeometry(2.5, 1);
    // Deform vertices for realistic rocky asteroids
    const pos = this.asteroidGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      v.multiplyScalar(0.75 + Math.random() * 0.5);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    this.asteroidGeo.computeVertexNormals();

    this.asteroidMat = new THREE.MeshStandardMaterial({
      color: 0x756b5a,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });

    // Laser material
    this.enemyLaserMat = new THREE.MeshBasicMaterial({
      color: 0xff0044,
      blending: THREE.AdditiveBlending,
    });
    this.enemyLaserGeo = new THREE.CylinderGeometry(0.18, 0.18, 2.4, 6);
    this.enemyLaserGeo.rotateX(Math.PI / 2);
  }

  spawnDrone() {
    const mesh = new THREE.Mesh(this.droneGeo, this.droneMat.clone());
    const startX = (Math.random() - 0.5) * 70;
    const startY = (Math.random() - 0.5) * 35;
    mesh.position.set(startX, startY, -260);

    this.enemies.push({
      type: 'drone',
      mesh,
      hp: 30,
      maxHp: 30,
      speedZ: 42 * (1 + this.difficultyMultiplier * 0.1),
      wiggleFreq: 2 + Math.random() * 2,
      wiggleAmp: 8 + Math.random() * 10,
      wiggleOffset: Math.random() * Math.PI * 2,
      time: 0,
      scoreValue: 100,
      radius: 2.0,
      fireTimer: 1.2 + Math.random() * 1.5,
    });
    this.scene.add(mesh);
  }

  spawnCruiser() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.cruiserGeo, this.cruiserMat.clone());
    group.add(body);

    // Left and right wings
    const wingGeo = new THREE.BoxGeometry(3.0, 0.4, 3.2);
    const leftWing = new THREE.Mesh(wingGeo, this.cruiserMat);
    leftWing.position.set(-3.2, 0, 0);
    group.add(leftWing);

    const rightWing = leftWing.clone();
    rightWing.position.set(3.2, 0, 0);
    group.add(rightWing);

    // Glowing core
    const coreGeo = new THREE.SphereGeometry(1.2, 12, 10);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 0.5, 0);
    group.add(core);

    const startX = (Math.random() - 0.5) * 60;
    const startY = (Math.random() - 0.5) * 30;
    group.position.set(startX, startY, -280);

    this.enemies.push({
      type: 'cruiser',
      mesh: group,
      hp: 120,
      maxHp: 120,
      speedZ: 24 * (1 + this.difficultyMultiplier * 0.08),
      time: 0,
      scoreValue: 350,
      radius: 4.2,
      fireTimer: 1.0 + Math.random(),
    });
    this.scene.add(group);
  }

  spawnAsteroid(scale = 1.0, x = null, y = null, z = -280) {
    const mesh = new THREE.Mesh(this.asteroidGeo, this.asteroidMat.clone());
    const posX = x !== null ? x : (Math.random() - 0.5) * 75;
    const posY = y !== null ? y : (Math.random() - 0.5) * 40;
    mesh.position.set(posX, posY, z);
    mesh.scale.set(scale, scale, scale);

    this.asteroids.push({
      mesh,
      scale,
      hp: 20 * scale,
      rotSpeed: {
        x: (Math.random() - 0.5) * 1.5,
        y: (Math.random() - 0.5) * 1.5,
        z: (Math.random() - 0.5) * 1.5,
      },
      vz: (30 + Math.random() * 20) * (1 + this.difficultyMultiplier * 0.05),
      radius: 2.2 * scale,
      scoreValue: Math.floor(50 * scale),
    });
    this.scene.add(mesh);
  }

  spawnBoss(level = 1) {
    if (this.activeBoss) return;
    sounds.playBossAlarm();

    const bossGroup = new THREE.Group();

    // Massive central hull
    const hullGeo = new THREE.BoxGeometry(16, 5, 22);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.3,
      metalness: 0.9,
    });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    bossGroup.add(hull);

    // Glowing plasma core
    const coreGeo = new THREE.SphereGeometry(3.5, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      wireframe: true,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 2, 0);
    bossGroup.add(core);

    // Wings with plasma thrusters
    const wingGeo = new THREE.ConeGeometry(5, 18, 5);
    wingGeo.rotateZ(Math.PI / 2);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x221133,
      metalness: 0.8,
    });

    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-14, 0, -2);
    bossGroup.add(leftWing);

    const rightWing = leftWing.clone();
    rightWing.position.set(14, 0, -2);
    rightWing.rotation.z = -Math.PI / 2;
    bossGroup.add(rightWing);

    bossGroup.position.set(0, 0, -260);

    const maxHp = 1000 + (level - 1) * 600;

    this.activeBoss = {
      type: 'boss',
      mesh: bossGroup,
      hp: maxHp,
      maxHp: maxHp,
      radius: 12,
      scoreValue: 2500,
      state: 'entering', // 'entering' -> 'fighting'
      targetZ: -120,
      time: 0,
      fireTimer: 1.0,
      specialTimer: 4.0,
      phase: 1,
    };

    this.scene.add(bossGroup);
  }

  update(delta, playerPos) {
    // 1. Spawning system
    this.spawnTimer += delta;
    this.asteroidTimer += delta;

    const droneInterval = Math.max(0.7, 2.2 - this.difficultyMultiplier * 0.15);
    const cruiserInterval = Math.max(3.0, 6.0 - this.difficultyMultiplier * 0.25);
    const asteroidInterval = 2.0;

    if (!this.activeBoss) {
      if (this.spawnTimer > droneInterval) {
        this.spawnDrone();
        if (Math.random() < 0.35 + this.difficultyMultiplier * 0.05) {
          this.spawnCruiser();
        }
        this.spawnTimer = 0;
      }
    }

    if (this.asteroidTimer > asteroidInterval) {
      const scale = 0.8 + Math.random() * 1.4;
      this.spawnAsteroid(scale);
      this.asteroidTimer = 0;
    }

    // 2. Update regular enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.time += delta;

      if (enemy.type === 'drone') {
        enemy.mesh.position.z += enemy.speedZ * delta;
        enemy.mesh.position.x += Math.cos(enemy.time * enemy.wiggleFreq + enemy.wiggleOffset) * enemy.wiggleAmp * delta;
        enemy.mesh.rotation.z = Math.sin(enemy.time * enemy.wiggleFreq) * 0.4;

        // Firing logic
        enemy.fireTimer -= delta;
        if (enemy.fireTimer <= 0 && enemy.mesh.position.z < -20) {
          this.fireEnemyLaser(enemy.mesh.position, playerPos, 70);
          enemy.fireTimer = 2.0 + Math.random() * 1.5;
        }
      } else if (enemy.type === 'cruiser') {
        enemy.mesh.position.z += enemy.speedZ * delta;
        // Tracking player gently on X
        const diffX = playerPos.x - enemy.mesh.position.x;
        enemy.mesh.position.x += Math.sign(diffX) * Math.min(Math.abs(diffX), 12) * delta;

        // Firing dual lasers
        enemy.fireTimer -= delta;
        if (enemy.fireTimer <= 0 && enemy.mesh.position.z < -20) {
          const posL = enemy.mesh.position.clone().add(new THREE.Vector3(-2.8, 0, 2));
          const posR = enemy.mesh.position.clone().add(new THREE.Vector3(2.8, 0, 2));
          this.fireEnemyLaser(posL, playerPos, 85);
          this.fireEnemyLaser(posR, playerPos, 85);
          enemy.fireTimer = 2.2 + Math.random();
        }
      }

      // Check out of bounds (past player camera)
      if (enemy.mesh.position.z > 25) {
        this.scene.remove(enemy.mesh);
        this.enemies.splice(i, 1);
      }
    }

    // 3. Update Asteroids
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const ast = this.asteroids[i];
      ast.mesh.position.z += ast.vz * delta;
      ast.mesh.rotation.x += ast.rotSpeed.x * delta;
      ast.mesh.rotation.y += ast.rotSpeed.y * delta;
      ast.mesh.rotation.z += ast.rotSpeed.z * delta;

      if (ast.mesh.position.z > 25) {
        this.scene.remove(ast.mesh);
        this.asteroids.splice(i, 1);
      }
    }

    // 4. Update Boss
    if (this.activeBoss) {
      const boss = this.activeBoss;
      boss.time += delta;

      if (boss.state === 'entering') {
        boss.mesh.position.z += 40 * delta;
        if (boss.mesh.position.z >= boss.targetZ) {
          boss.mesh.position.z = boss.targetZ;
          boss.state = 'fighting';
        }
      } else {
        // Boss battle movement pattern (sweeping figure-eight)
        boss.mesh.position.x = Math.sin(boss.time * 0.8) * 32;
        boss.mesh.position.y = Math.cos(boss.time * 1.6) * 12;
        boss.mesh.rotation.z = Math.sin(boss.time * 0.8) * 0.15;

        // Boss firing patterns
        boss.fireTimer -= delta;
        if (boss.fireTimer <= 0) {
          // Spread barrage
          for (let ang = -0.3; ang <= 0.3; ang += 0.15) {
            this.fireEnemyLaserAngle(boss.mesh.position, ang, 90);
          }
          boss.fireTimer = boss.hp < boss.maxHp * 0.5 ? 1.0 : 1.6;
        }

        boss.specialTimer -= delta;
        if (boss.specialTimer <= 0) {
          // Circular plasma shock
          for (let i = 0; i < 8; i++) {
            const rad = (i / 8) * Math.PI * 2;
            this.fireEnemyLaserAngle(boss.mesh.position, Math.sin(rad) * 0.5, 100);
          }
          boss.specialTimer = 5.0;
        }
      }
    }

    // 5. Update Enemy Lasers
    for (let i = this.enemyLasers.length - 1; i >= 0; i--) {
      const l = this.enemyLasers[i];
      l.mesh.position.x += l.vx * delta;
      l.mesh.position.y += l.vy * delta;
      l.mesh.position.z += l.vz * delta;
      l.life -= delta;

      if (l.life <= 0 || l.mesh.position.z > 30) {
        this.scene.remove(l.mesh);
        l.mesh.geometry.dispose();
        l.mesh.material.dispose();
        this.enemyLasers.splice(i, 1);
      }
    }
  }

  fireEnemyLaser(fromPos, toPos, speed = 80) {
    sounds.playEnemyLaser();
    const mesh = new THREE.Mesh(this.enemyLaserGeo, this.enemyLaserMat);
    mesh.position.copy(fromPos);

    const dir = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
    // Mostly forward toward camera
    if (dir.z < 0.2) dir.z = 0.8;
    dir.normalize();

    this.scene.add(mesh);
    this.enemyLasers.push({
      mesh,
      vx: dir.x * speed,
      vy: dir.y * speed,
      vz: Math.abs(dir.z) * speed,
      damage: 18,
      life: 4.5,
    });
  }

  fireEnemyLaserAngle(fromPos, angleX, speed = 90) {
    sounds.playEnemyLaser();
    const mesh = new THREE.Mesh(this.enemyLaserGeo, this.enemyLaserMat);
    mesh.position.copy(fromPos);

    this.scene.add(mesh);
    this.enemyLasers.push({
      mesh,
      vx: Math.sin(angleX) * speed,
      vy: 0,
      vz: Math.cos(angleX) * speed,
      damage: 22,
      life: 4.5,
    });
  }

  wipeAllEnemiesEMP() {
    let scoreGained = 0;
    // Destroy all drones & cruisers
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      this.fx.createExplosion(e.mesh.position.x, e.mesh.position.y, e.mesh.position.z, 0x00f3ff, 25, 1.2);
      scoreGained += e.scoreValue;
      this.scene.remove(e.mesh);
      this.enemies.splice(i, 1);
    }
    // Shatter asteroids
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const a = this.asteroids[i];
      this.fx.createExplosion(a.mesh.position.x, a.mesh.position.y, a.mesh.position.z, 0x999999, 20, 1.0);
      scoreGained += a.scoreValue;
      this.scene.remove(a.mesh);
      this.asteroids.splice(i, 1);
    }
    // Wipe lasers
    for (let i = this.enemyLasers.length - 1; i >= 0; i--) {
      this.scene.remove(this.enemyLasers[i].mesh);
      this.enemyLasers.splice(i, 1);
    }
    // Damage boss if active
    if (this.activeBoss) {
      this.activeBoss.hp -= 250;
      this.fx.createExplosion(this.activeBoss.mesh.position.x, this.activeBoss.mesh.position.y, this.activeBoss.mesh.position.z, 0x00f3ff, 50, 2.5);
    }

    return scoreGained;
  }

  reset() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];

    for (const a of this.asteroids) this.scene.remove(a.mesh);
    this.asteroids = [];

    for (const l of this.enemyLasers) this.scene.remove(l.mesh);
    this.enemyLasers = [];

    if (this.activeBoss) {
      this.scene.remove(this.activeBoss.mesh);
      this.activeBoss = null;
    }

    this.spawnTimer = 0;
    this.asteroidTimer = 0;
    this.difficultyMultiplier = 1.0;
  }
}
