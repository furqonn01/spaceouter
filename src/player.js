import * as THREE from 'three';
import { sounds } from './audio.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();

    // Stats
    this.maxHp = 100;
    this.hp = 100;
    this.maxShield = 100;
    this.shield = 100;
    this.shieldActive = true;
    this.empCount = 2;
    this.weaponLevel = 1; // 1: Dual, 2: Triple, 3: Overdrive Quad
    this.weaponTimer = 0; // Temporary boost timer
    this.speed = 46;
    this.boostMultiplier = 1.0;

    // Movement state
    this.velocity = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.bounds = { minX: -42, maxX: 42, minY: -24, maxY: 24 };

    // Weapon cooldown
    this.fireRate = 0.16; // seconds between shots
    this.fireTimer = 0;
    this.lasers = [];

    // Shield flash timer
    this.shieldHitTimer = 0;

    this.buildShipMesh();
    this.scene.add(this.mesh);
  }

  buildShipMesh() {
    // 1. Fuselage (Central Jet Body)
    const bodyGeo = new THREE.ConeGeometry(1.4, 5.5, 6);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a2b4c,
      metalness: 0.85,
      roughness: 0.25,
      flatShading: true,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    this.mesh.add(body);

    // Nose accent
    const noseGeo = new THREE.ConeGeometry(0.8, 2.0, 5);
    noseGeo.rotateX(Math.PI / 2);
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0x00f3ff,
      emissive: 0x00a8cc,
      emissiveIntensity: 0.6,
      metalness: 0.9,
    });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.z = -2.2;
    this.mesh.add(nose);

    // 2. Cockpit Canopy
    const canopyGeo = new THREE.SphereGeometry(0.7, 16, 12);
    canopyGeo.scale(0.85, 0.7, 2.2);
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f3ff,
      emissive: 0x0099bb,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 0.55, -0.4);
    this.mesh.add(canopy);

    // 3. Swept Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(4.8, -1.8);
    wingShape.lineTo(4.6, -3.2);
    wingShape.lineTo(0, -1.4);
    wingShape.closePath();

    const extrudeSettings = { depth: 0.22, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.08, bevelThickness: 0.08 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.rotateX(Math.PI / 2);

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x22365c,
      metalness: 0.8,
      roughness: 0.3,
    });

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0.6, 0, 0.2);
    this.mesh.add(rightWing);

    const leftWing = rightWing.clone();
    leftWing.scale.x = -1;
    leftWing.position.set(-0.6, 0, 0.2);
    this.mesh.add(leftWing);

    // Wingtip blasters
    const gunGeo = new THREE.CylinderGeometry(0.18, 0.18, 2.2, 8);
    gunGeo.rotateX(Math.PI / 2);
    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x334466,
      metalness: 0.9,
      roughness: 0.2,
    });

    this.rightGun = new THREE.Mesh(gunGeo, gunMat);
    this.rightGun.position.set(4.6, 0, -1.2);
    this.mesh.add(this.rightGun);

    this.leftGun = new THREE.Mesh(gunGeo, gunMat);
    this.leftGun.position.set(-4.6, 0, -1.2);
    this.mesh.add(this.leftGun);

    // 4. Twin Plasma Thrusters
    const thrusterGeo = new THREE.CylinderGeometry(0.4, 0.45, 1.0, 10);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      metalness: 0.9,
    });

    const leftThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    leftThruster.position.set(-0.75, 0.1, 2.4);
    this.mesh.add(leftThruster);

    const rightThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    rightThruster.position.set(0.75, 0.1, 2.4);
    this.mesh.add(rightThruster);

    // Thruster Jet Glow
    const flameGeo = new THREE.ConeGeometry(0.35, 2.2, 8);
    flameGeo.rotateX(-Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.85,
    });

    this.leftFlame = new THREE.Mesh(flameGeo, flameMat);
    this.leftFlame.position.set(-0.75, 0.1, 3.4);
    this.mesh.add(this.leftFlame);

    this.rightFlame = new THREE.Mesh(flameGeo, flameMat.clone());
    this.rightFlame.position.set(0.75, 0.1, 3.4);
    this.mesh.add(this.rightFlame);

    // 5. Forcefield Shield Sphere
    const shieldGeo = new THREE.SphereGeometry(3.6, 24, 20);
    this.shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      wireframe: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, this.shieldMat);
    this.mesh.add(this.shieldMesh);

    // Point Light on engine
    this.engineLight = new THREE.PointLight(0x00f3ff, 2.5, 12);
    this.engineLight.position.set(0, 0, 3.2);
    this.mesh.add(this.engineLight);
  }

  takeDamage(amount) {
    if (this.shield > 0) {
      this.shield -= amount;
      this.shieldHitTimer = 0.28;
      sounds.playShieldHit();
      if (this.shield < 0) {
        this.hp += this.shield;
        this.shield = 0;
      }
    } else {
      this.hp -= amount;
      sounds.playExplosion(false);
      this.shieldHitTimer = 0.15;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      return true; // Destroyed
    }
    return false;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.shield = Math.min(this.maxShield, this.shield + amount * 0.5);
  }

  upgradeWeapon() {
    this.weaponLevel = Math.min(3, this.weaponLevel + 1);
    this.weaponTimer = 18; // 18 seconds duration
  }

  fireLaser() {
    if (this.fireTimer > 0) return;

    this.fireTimer = this.fireRate;
    sounds.playLaser(this.weaponLevel > 1);

    const laserSpeed = 160;
    const laserMat = new THREE.MeshBasicMaterial({
      color: this.weaponLevel === 3 ? 0xff0077 : 0x00f3ff,
      blending: THREE.AdditiveBlending,
    });
    const laserGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.8, 6);
    laserGeo.rotateX(Math.PI / 2);

    const createBolt = (offsetX, offsetY, dirX = 0, dirY = 0) => {
      const bolt = new THREE.Mesh(laserGeo, laserMat);
      bolt.position.set(
        this.mesh.position.x + offsetX,
        this.mesh.position.y + offsetY,
        this.mesh.position.z - 2.5
      );
      this.scene.add(bolt);
      this.lasers.push({
        mesh: bolt,
        vx: dirX * laserSpeed,
        vy: dirY * laserSpeed,
        vz: -laserSpeed,
        damage: this.weaponLevel === 3 ? 35 : 25,
        life: 2.2,
      });
    };

    if (this.weaponLevel === 1) {
      // Dual wing blasters
      createBolt(4.6, 0);
      createBolt(-4.6, 0);
    } else if (this.weaponLevel === 2) {
      // Triple spread
      createBolt(0, 0.4, 0, 0);
      createBolt(4.6, 0, 0.08, 0);
      createBolt(-4.6, 0, -0.08, 0);
    } else {
      // Quad Overdrive
      createBolt(-2.2, 0, -0.04, 0);
      createBolt(2.2, 0, 0.04, 0);
      createBolt(-4.6, 0, -0.12, 0);
      createBolt(4.6, 0, 0.12, 0);
    }
  }

  update(delta, input) {
    // 1. Weapon Timer
    if (this.weaponTimer > 0) {
      this.weaponTimer -= delta;
      if (this.weaponTimer <= 0) {
        this.weaponLevel = 1;
      }
    }

    // 2. Shield regeneration
    if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + delta * 4);
    }

    // 3. Movement input handling
    this.boostMultiplier = input.boost ? 1.6 : 1.0;
    const currentSpeed = this.speed * this.boostMultiplier;

    let moveX = 0;
    let moveY = 0;

    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;
    if (input.up) moveY += 1;
    if (input.down) moveY -= 1;

    // Normalize diagonal
    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.7071;
      moveY *= 0.7071;
    }

    // Smooth movement lerp
    this.mesh.position.x += moveX * currentSpeed * delta;
    this.mesh.position.y += moveY * currentSpeed * delta;

    // Bounds clamping
    this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, this.bounds.minX, this.bounds.maxX);
    this.mesh.position.y = THREE.MathUtils.clamp(this.mesh.position.y, this.bounds.minY, this.bounds.maxY);

    // Roll & Pitch tilting for dynamic feel
    const targetRoll = -moveX * 0.45;
    const targetPitch = moveY * 0.25;
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetRoll, 0.14);
    this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, targetPitch, 0.14);

    // Pulsing engine thrusters
    const flameScale = (0.9 + Math.random() * 0.3) * (input.boost ? 1.7 : 1.0);
    this.leftFlame.scale.set(flameScale, flameScale, flameScale * 1.4);
    this.rightFlame.scale.set(flameScale, flameScale, flameScale * 1.4);
    this.engineLight.intensity = (2.0 + Math.random() * 0.8) * (input.boost ? 2.0 : 1.0);

    // Shield glow on hit or shield active
    if (this.shieldHitTimer > 0) {
      this.shieldHitTimer -= delta;
      this.shieldMat.opacity = 0.65;
    } else {
      this.shieldMat.opacity = this.shield > 20 ? 0.08 : 0.0;
    }

    // Fire cooldown
    if (this.fireTimer > 0) {
      this.fireTimer -= delta;
    }
    if (input.fire) {
      this.fireLaser();
    }

    // Update Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.mesh.position.x += laser.vx * delta;
      laser.mesh.position.y += laser.vy * delta;
      laser.mesh.position.z += laser.vz * delta;
      laser.life -= delta;

      if (laser.life <= 0 || laser.mesh.position.z < -280) {
        this.scene.remove(laser.mesh);
        laser.mesh.geometry.dispose();
        laser.mesh.material.dispose();
        this.lasers.splice(i, 1);
      }
    }
  }

  reset() {
    this.hp = this.maxHp;
    this.shield = this.maxShield;
    this.weaponLevel = 1;
    this.weaponTimer = 0;
    this.empCount = 2;
    this.mesh.position.set(0, 0, 0);
    this.mesh.rotation.set(0, 0, 0);

    // Clear lasers
    for (const laser of this.lasers) {
      this.scene.remove(laser.mesh);
      laser.mesh.geometry.dispose();
      laser.mesh.material.dispose();
    }
    this.lasers = [];
  }
}
