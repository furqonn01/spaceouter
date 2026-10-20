import * as THREE from 'three';

export class FXManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.shockwaves = [];
    this.shakeIntensity = 0;
    this.shakeDecay = 0.92;

    this.initStarfields();
  }

  initStarfields() {
    // 1. Deep background stars (dense, subtle)
    const deepStarCount = 1500;
    const deepGeo = new THREE.BufferGeometry();
    const deepPos = new Float32Array(deepStarCount * 3);
    const deepColors = new Float32Array(deepStarCount * 3);

    for (let i = 0; i < deepStarCount; i++) {
      deepPos[i * 3] = (Math.random() - 0.5) * 800;
      deepPos[i * 3 + 1] = (Math.random() - 0.5) * 600;
      deepPos[i * 3 + 2] = -Math.random() * 800;

      // Color variation: cyan, blue, violet, warm white
      const c = new THREE.Color();
      const r = Math.random();
      if (r < 0.4) c.setHex(0x00f3ff); // Cyan
      else if (r < 0.7) c.setHex(0x9d4edd); // Purple
      else c.setHex(0xffffff); // White

      deepColors[i * 3] = c.r;
      deepColors[i * 3 + 1] = c.g;
      deepColors[i * 3 + 2] = c.b;
    }

    deepGeo.setAttribute('position', new THREE.BufferAttribute(deepPos, 3));
    deepGeo.setAttribute('color', new THREE.BufferAttribute(deepColors, 3));

    const deepMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.deepStars = new THREE.Points(deepGeo, deepMat);
    this.scene.add(this.deepStars);

    // 2. Fast warp streaks / foreground stars
    const warpCount = 600;
    const warpGeo = new THREE.BufferGeometry();
    const warpPos = new Float32Array(warpCount * 3);
    for (let i = 0; i < warpCount; i++) {
      warpPos[i * 3] = (Math.random() - 0.5) * 260;
      warpPos[i * 3 + 1] = (Math.random() - 0.5) * 180;
      warpPos[i * 3 + 2] = -Math.random() * 500;
    }
    warpGeo.setAttribute('position', new THREE.BufferAttribute(warpPos, 3));

    const warpMat = new THREE.PointsMaterial({
      size: 3.5,
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    this.warpStars = new THREE.Points(warpGeo, warpMat);
    this.scene.add(this.warpStars);
  }

  triggerScreenShake(intensity = 1.0) {
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 3.5);
  }

  createExplosion(x, y, z, colorHex = 0xff5500, count = 45, scale = 1.0) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const colors = new Float32Array(count * 3);
    const baseColor = new THREE.Color(colorHex);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Spherical explosion velocities
      const speed = (20 + Math.random() * 60) * scale;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      velocities.push({
        vx: speed * Math.sin(phi) * Math.cos(theta),
        vy: speed * Math.sin(phi) * Math.sin(theta),
        vz: speed * Math.cos(phi),
      });

      // Color variation from bright core to deep fire/plasma
      const c = baseColor.clone();
      if (Math.random() > 0.4) c.offsetHSL(0.08, 0, 0.2);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 4.5 * scale,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const mesh = new THREE.Points(geo, mat);
    this.scene.add(mesh);

    this.particles.push({
      mesh,
      velocities,
      life: 1.0,
      decay: 1.8 / scale,
    });

    // Expanding shockwave ring
    const ringGeo = new THREE.RingGeometry(0.2, 1.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, y, z);
    ring.rotation.x = 0;
    this.scene.add(ring);

    this.shockwaves.push({
      mesh: ring,
      scale: 1,
      maxScale: 28 * scale,
      life: 1.0,
      decay: 2.5,
    });
  }

  createEMPWave(x, y, z) {
    const ringGeo = new THREE.RingGeometry(0.5, 3.5, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, y, z);
    this.scene.add(ring);

    this.shockwaves.push({
      mesh: ring,
      scale: 1,
      maxScale: 140,
      life: 1.0,
      decay: 1.4,
    });

    this.triggerScreenShake(2.5);
  }

  update(delta, warpSpeedMultiplier = 1.0) {
    // 1. Update deep stars
    const dPos = this.deepStars.geometry.attributes.position.array;
    for (let i = 2; i < dPos.length; i += 3) {
      dPos[i] += delta * 60 * warpSpeedMultiplier;
      if (dPos[i] > 100) dPos[i] = -700;
    }
    this.deepStars.geometry.attributes.position.needsUpdate = true;

    // 2. Update warp foreground stars
    const wPos = this.warpStars.geometry.attributes.position.array;
    for (let i = 2; i < wPos.length; i += 3) {
      wPos[i] += delta * 240 * warpSpeedMultiplier;
      if (wPos[i] > 50) wPos[i] = -450;
    }
    this.warpStars.geometry.attributes.position.needsUpdate = true;

    // 3. Update particle bursts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta * p.decay;
      p.mesh.material.opacity = Math.max(0, p.life);

      const pos = p.mesh.geometry.attributes.position.array;
      for (let j = 0; j < p.velocities.length; j++) {
        const vel = p.velocities[j];
        pos[j * 3] += vel.vx * delta;
        pos[j * 3 + 1] += vel.vy * delta;
        pos[j * 3 + 2] += vel.vz * delta;

        // Friction/drag
        vel.vx *= 0.96;
        vel.vy *= 0.96;
        vel.vz *= 0.96;
      }
      p.mesh.geometry.attributes.position.needsUpdate = true;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // 4. Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= delta * sw.decay;
      sw.scale += delta * sw.maxScale * 2.2;
      sw.mesh.scale.set(sw.scale, sw.scale, sw.scale);
      sw.mesh.material.opacity = Math.max(0, sw.life);

      if (sw.life <= 0) {
        this.scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        sw.mesh.material.dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    // 5. Update screen shake
    if (this.shakeIntensity > 0.01) {
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeIntensity = 0;
    }
  }

  getShakeOffset() {
    if (this.shakeIntensity <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shakeIntensity * 1.5,
      y: (Math.random() - 0.5) * this.shakeIntensity * 1.5,
    };
  }
}
