import * as THREE from 'three';
import { sounds } from './audio.js';

export class CollectibleManager {
  constructor(scene) {
    this.scene = scene;
    this.items = [];

    // Base geometry and materials
    this.octaGeo = new THREE.OctahedronGeometry(1.2);
    this.ringGeo = new THREE.TorusGeometry(1.8, 0.15, 8, 24);

    this.types = {
      weapon: { color: 0x00f3ff, name: 'WEAPON UPGRADE' },
      shield: { color: 0x0088ff, name: 'SHIELD RECHARGE' },
      repair: { color: 0x00ff88, name: 'NANO REPAIR' },
      emp: { color: 0xffaa00, name: 'EMP BOMB' },
    };
  }

  spawnPowerup(x, y, z, forcedType = null) {
    const typeKeys = Object.keys(this.types);
    const type = forcedType || typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const config = this.types[type];

    const group = new THREE.Group();

    // Center jewel
    const mat = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2,
    });
    const jewel = new THREE.Mesh(this.octaGeo, mat);
    group.add(jewel);

    // Glowing orbiting ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: config.color,
      wireframe: true,
    });
    const ring = new THREE.Mesh(this.ringGeo, ringMat);
    group.add(ring);

    // Light
    const pLight = new THREE.PointLight(config.color, 1.5, 8);
    group.add(pLight);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.items.push({
      mesh: group,
      type,
      vz: 26,
      rotSpeed: 2.2,
      time: 0,
    });
  }

  maybeDrop(x, y, z, chance = 0.25) {
    if (Math.random() < chance) {
      this.spawnPowerup(x, y, z);
    }
  }

  update(delta, player, onCollect) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.time += delta;
      item.mesh.position.z += item.vz * delta;
      item.mesh.rotation.y += item.rotSpeed * delta;
      item.mesh.rotation.x += item.rotSpeed * 0.7 * delta;

      // Magnetic pull towards player if close
      const dist = item.mesh.position.distanceTo(player.mesh.position);
      if (dist < 14) {
        const pullDir = new THREE.Vector3().subVectors(player.mesh.position, item.mesh.position).normalize();
        item.mesh.position.addScaledVector(pullDir, delta * 30);
      }

      // Check collision with player
      if (dist < 3.8) {
        sounds.playPowerup();
        this.applyEffect(item.type, player);
        if (onCollect) onCollect(item.type);

        this.scene.remove(item.mesh);
        this.items.splice(i, 1);
        continue;
      }

      // Out of bounds
      if (item.mesh.position.z > 25) {
        this.scene.remove(item.mesh);
        this.items.splice(i, 1);
      }
    }
  }

  applyEffect(type, player) {
    switch (type) {
      case 'weapon':
        player.upgradeWeapon();
        break;
      case 'shield':
        player.shield = Math.min(player.maxShield, player.shield + 60);
        break;
      case 'repair':
        player.heal(40);
        break;
      case 'emp':
        player.empCount = Math.min(5, player.empCount + 1);
        break;
    }
  }

  reset() {
    for (const item of this.items) {
      this.scene.remove(item.mesh);
    }
    this.items = [];
  }
}
