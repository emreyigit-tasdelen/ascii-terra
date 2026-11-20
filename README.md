<div align="center">

```
    _    ____   ____ ___ ___     _____ _____ ____  ____      _
   / \  / ___| / ___|_ _|_ _|   |_   _| ____|  _ \|  _ \    / \
  / _ \ \___ \| |    | | | |_____| | |  _| | |_) | |_) |  / _ \
 / ___ \ ___) | |___ | | | |_____| | | |___|  _ <|  _ <  / ___ \
/_/   \_\____/ \____|___|___|    |_| |_____|_| \_\_| \_\/_/   \_\
```

### Every pixel is a letter.

A dark-knight action RPG drawn entirely with ASCII characters, in real time, in your browser.

[![Release](https://img.shields.io/github/v/release/emreyigit-tasdelen/ascii-terra?color=c9a227)](https://github.com/emreyigit-tasdelen/ascii-terra/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Zero dependencies](https://img.shields.io/badge/server-zero%20dependencies-brightgreen)

**English** · [Türkçe](README.tr.md)

<img src="docs/village.jpg" alt="The village at night: campfire, villagers and tall grass, all in ASCII" width="800">

**[Quick start](#quick-start)** · [Install guide](docs/INSTALL.md) · [Roadmap](ROADMAP.md)

</div>

---

## What is this?

ASCII-Terra is an open-world action RPG where the picture is made of text. Stone walls are dense letter textures,
grass is `/ | \` strokes that follow each blade, water is black with white `~ =` foam, and fire flickers in orange `# % &`.
Even the rain and the sea are glyphs.

You play **Torvan**, a knight in silver plate. Clear the undead from the castle ruins, hunt wolves, cross the foggy swamp,
defeat the giant spider *Gloomweaver* and take the oath at the Stone Circle. Play alone, with friends on your network, or from a tablet.

> **Status:** early development. The long-term goal is an online ASCII MMORPG. See the [roadmap](ROADMAP.md).

## Why it looks different

- **A real 3D scene underneath.** Three.js draws the world off-screen with shadows, shiny armor and particles. A custom shader then turns it into text.
- **The glyph depends on the material.** Every surface says what it is: stone, grass, water, metal, fire each have their own character set.
- **Nothing on screen is a picture.** Characters, creatures and effects are all built from glyphs. That is the one rule of the project.

## Quick start

The game runs in your browser but needs a small local server (included, no install step, no packages).

**Windows:** download the [latest release](https://github.com/emreyigit-tasdelen/ascii-terra/releases/latest), unzip, double-click **`start.bat`**.

**Any system with [Node.js](https://nodejs.org) 22.13+:**

```bash
git clone https://github.com/emreyigit-tasdelen/ascii-terra.git
cd ascii-terra
node server/server.js     # then open http://localhost:8765
```

`start.bat` updates the game from GitHub releases on every start and never touches your accounts or saves.
Step by step, firewall and troubleshooting: **[docs/INSTALL.md](docs/INSTALL.md)**.

## Highlights

| | |
|---|---|
| **Combat** | Sword combos, shield block and **parry**, fireball, whirlwind, void orb, moon lance, dodge roll, jump, horse. Bosses show their attacks as ground circles and enrage at half health. |
| **World** | Village, ruined castle, foamy coast with standing stones, forests and the Misty Swamp. World map, 9-quest chain, loot on the ground, rune crafting for blade and armor. |
| **Creatures** | Skeletons, dark knights, dire wolves that flee when hurt, ghouls, witches, a troll, the spider *Gloomweaver* and the *Ash Dragon*. |
| **Multiplayer** | Up to 32 players, co-op with automatic host migration, chat, parties with shared XP and quests, PvP duels, accounts saved on the server. |
| **Tablets** | iPad and Android: floating joystick, swipe to look and aim, pinch to zoom, action buttons. |
| **Feel** | Day and night, rain, fog, hit-stop, camera shake, sound generated in code. |

## Play with friends and tablets

1. Run `start.bat` on **one PC**. It is the server.
2. The console prints `For friends on your local network → http://192.168.x.x:8765`.
3. Everyone on the same network opens that address, on a PC or a tablet. Tablets: hold them sideways.

On a tablet, drag the left half to walk, swipe the right half to look and aim, pinch to zoom.
Over the internet: put the server behind HTTPS on a VPS (the client switches to `wss://`). Details in the [install guide](docs/INSTALL.md).

## Controls

| Key | Action |
|---|---|
| `W A S D` / `Shift` | move / run |
| `Space` / `C` | jump / roll |
| Left click or `1` | sword, 3-hit combo |
| `Alt` (hold) | shield; block right on impact to parry |
| `2` `3` `5` `6` | fireball, whirlwind, void orb, moon lance |
| `E` `F` `I` `K` `M` | talk, horse, inventory, craft, map |
| `Enter` / `G` / `J` | chat / duel / party invite |
| `Esc` | pause menu, key rebinding |

Everything else: press `H` in the game.

## How the renderer works

1. The scene is drawn at full resolution into an off-screen target.
2. Each material writes a **material ID** into the alpha channel. Grass also stores the on-screen angle of every blade.
3. A full-screen pass splits the screen into glyph cells, samples each cell 3×3 and picks a glyph from that material's set, coloured by the scene.
4. Thin things (rain, webs, flowers) claim a cell if any sample hits them, so one-pixel lines never vanish.

Code: `src/core.js` (material IDs), `src/render.js` (the pass). Style rules: [docs/STYLE-GUIDE.md](docs/STYLE-GUIDE.md).

## Project structure

```
src/core.js, render.js     math, terrain, material IDs, the ASCII pass
src/world.js, models.js    terrain, castle, swamp, characters and animation
src/actors.js, game.js     player, enemy AI, skills, quests, items, HUD
src/net.js, duel.js, party.js, touch.js   multiplayer, duels, parties, tablet controls
server/                    zero-dependency Node.js server, SQLite, admin CLI
start.bat, update.bat      launcher and release updater
```

## Support

Developed in the open. If you enjoy it:
[GitHub Sponsors](https://github.com/sponsors/emreyigit-tasdelen) · [Buy Me a Coffee](https://buymeacoffee.com/emreyigit.tasdelen)

## Contributing

Issues and pull requests are welcome. One rule: **everything that appears on screen must be ASCII.**

## License

[MIT](LICENSE)
