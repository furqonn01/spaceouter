import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
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

    // Visual groups
    this.modelContainer = new THREE.Group();
    this.mesh.add(this.modelContainer);

    this.initThrustersAndShield();
    this.loadMilitaryModel();

    this.scene.add(this.mesh);
  }

  initThrustersAndShield() {
    // Twin Plasma Thrusters Jet Glow
    const flameGeo = new THREE.ConeGeometry(0.38, 2.5, 8);
    flameGeo.rotateX(-Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.9,
    });

    this.leftFlame = new THREE.Mesh(flameGeo, flameMat);
    this.leftFlame.position.set(-0.8, 0, 3.2);
    this.mesh.add(this.leftFlame);

    this.rightFlame = new THREE.Mesh(flameGeo, flameMat.clone());
    this.rightFlame.position.set(0.8, 0, 3.2);
    this.mesh.add(this.rightFlame);

    // Forcefield Shield Sphere
    const shieldGeo = new THREE.SphereGeometry(4.2, 24, 20);
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
    this.engineLight = new THREE.PointLight(0x00f3ff, 2.8, 14);
    this.engineLight.position.set(0, 0, 3.0);
    this.mesh.add(this.engineLight);
  }

  loadMilitaryModel() {
    const loader = new FBXLoader();
    const modelPath = '/models/millitary/Military_Rockett.fbx';

    loader.load(
      modelPath,
      (fbx) => {
        // Clear placeholder if any
        while (this.modelContainer.children.length > 0) {
          this.modelContainer.remove(this.modelContainer.children[0]);
        }

        // Calculate bounding box and center
        const box = new THREE.Box3().setFromObject(fbx);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        console.log('Military Model Loaded! Dimensions:', size, 'Center:', center);

        // Center model geometry at origin
        fbx.position.set(-center.x, -center.y, -center.z);

        const pivot = new THREE.Group();
        pivot.add(fbx);

        // Standardize size to fit gameplay (target length ~7.5 units)
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 7.5 / (maxDim || 1);
        pivot.scale.setScalar(targetScale);

        // Determine orientation:
        // Military Rocket model has nose along -X and tail along +X, with wings along Z.
        // Rotating by -Math.PI / 2 around Y turns nose to -Z (forward) and tail to +Z (camera-facing),
        // spreading the wings horizontally along X.
        if (size.x >= size.y && size.x >= size.z) {
          pivot.rotation.y = -Math.PI / 2;
        } else if (size.y >= size.z && size.y >= size.x) {
          pivot.rotation.x = -Math.PI / 2;
        }

        // Enhance materials with military stealth finish & metallic highlights
        fbx.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat) => {
                // If material is basic or standard, tune it to military sci-fi
                mat.roughness = 0.35;
                mat.metalness = 0.75;
                if (!mat.color || (mat.color.r === 1 && mat.color.g === 1 && mat.color.b === 1)) {
                  mat.color = new THREE.Color(0x3a4f63); // Tactical stealth blue-grey
                }
              });
            }
          }
        });

        // Add model to container
        this.modelContainer.add(pivot);

        // Reposition thrusters to match rocket exhaust at back
        this.leftFlame.position.set(-0.7, 0, 3.4);
        this.rightFlame.position.set(0.7, 0, 3.4);
        this.engineLight.position.set(0, 0, 3.2);
      },
      undefined,
      (err) => {
        console.warn('Failed to load Military model, using procedural fallback:', err);
        this.buildProceduralFallback();
      }
    );
  }

  buildProceduralFallback() {
    // Fuselage
    const bodyGeo = new THREE.ConeGeometry(1.4, 5.5, 6);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2d3a4b,
      metalness: 0.8,
      roughness: 0.3,
      flatShading: true,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    this.modelContainer.add(body);
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
        this.mesh.position.z - 3.2
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
      // Dual side rocket cannons
      createBolt(2.2, 0);
      createBolt(-2.2, 0);
    } else if (this.weaponLevel === 2) {
      // Triple spread
      createBolt(0, 0.5, 0, 0);
      createBolt(2.6, 0, 0.08, 0);
      createBolt(-2.6, 0, -0.08, 0);
    } else {
      // Quad Overdrive
      createBolt(-1.4, 0, -0.04, 0);
      createBolt(1.4, 0, 0.04, 0);
      createBolt(-3.0, 0, -0.12, 0);
      createBolt(3.0, 0, 0.12, 0);
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
    this.engineLight.intensity = (2.2 + Math.random() * 0.8) * (input.boost ? 2.2 : 1.0);

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
