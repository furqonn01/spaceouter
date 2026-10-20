# Astro Strike 3D - Space Shooter

A fast-paced, action-packed 3D Space Shooter mini-game built with **Three.js**, **Vanilla CSS**, and **Vite**, featuring procedural **Web Audio API** synthesized sound effects.

![Astro Strike 3D](https://raw.githubusercontent.com/furqonn01/spaceouter/main/preview.png)

## 🎮 Features

- **Procedural 3D Starfighter**: Complete with aerodynamic wings, glowing cockpit, forcefield shield bubble, and dynamic engine thruster flares.
- **Dynamic Flight Physics**: Smooth flight controls with realistic bank/roll tilting and pitch control.
- **Varied Enemy Units**:
  - *Scout Drones*: Fast, agile zig-zag interceptors.
  - *Heavy Cruisers*: Heavily armored battleships firing dual plasma cannons.
  - *Asteroid Hazards*: Rotating, destructible deep space debris.
  - *Capital Mothership (Boss)*: Epic boss encounter with dedicated health bar, radial bullet sprays, and spiral laser barrage.
- **Power-Up System**:
  - ⚡ *Weapon Overdrive*: Upgrade from dual lasers to triple spread and quad plasma cannons.
  - 🛡️ *Shield Recharge*: Replenishes defensive energy shields.
  - 💚 *Nano Repair*: Restores spaceship hull integrity.
  - 💣 *EMP Superweapon*: Unleash screen-clearing shockwaves.
- **Synthesized Audio (Web Audio API)**: Zero external audio files required. Lasers, explosions, shield impacts, engine rumble, and alarms are synthesized in real-time.
- **Mobile & Touch Support**: Built-in virtual analog joystick and on-screen firing buttons for smartphones and tablets.

## 🕹️ Controls

- **Steer / Move**: `W`, `A`, `S`, `D` or `Arrow Keys`
- **Fire Primary Lasers**: `Spacebar` or `Left Mouse Click`
- **Afterburner Boost**: `Left / Right Shift`
- **EMP Bomb**: `E`, `B`, or `Q`
- **Mobile**: Virtual joystick on bottom left, FIRE and EMP buttons on bottom right.

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/furqonn01/spaceouter.git
   cd spaceouter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## 🛠️ Tech Stack

- **Three.js** (WebGL 3D Rendering)
- **Vite** (Next Generation Frontend Tooling)
- **Web Audio API** (Procedural Sound Generation)
- **Vanilla CSS** (Cyberpunk Glassmorphism UI & HUD)
