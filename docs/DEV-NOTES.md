# Development Notes (session handoff)

> A new session starts here. Updated after every step. Detailed plan: [ROADMAP.md](../ROADMAP.md), visual rules: [STYLE-GUIDE.md](STYLE-GUIDE.md).

## Rules
- **Everything on screen is ASCII** (no direct 3D drawing).
- **The whole project is in English** (code, comments, UI, docs). `README.tr.md` is the only Turkish file: a translation of the README.
- Commit + push after every change. Author: `emreyigit-tasdelen` + noreply e-mail. Claude is never credited as contributor/co-author.
- No personal data (e-mails, local paths, account data). `server/data/` is git-ignored.
- Update README.md (EN) and README.tr.md (TR) together.
- Testing: `PORT=8766 node server/server.js` (in the background), open `http://localhost:8766` in the browser pane. Stop the process afterwards and delete the `server/data` test data.

## Architecture (short)
`src/core.js` (height, collision, MID) · `render.js` (ASCII pass, light, shadows) · `world.js` (terrain, village, castle, swamp) · `models.js` (models + `animBiped`) · `actors.js` (player, enemy AI, skills, shield) · `fx.js` (particles) · `game.js` (quests, inventory, HUD, saving) · `net.js` (multiplayer client) · `main.js` (input, loop, start screen, pause) · `server/server.js` (dependency-free Node: static + WebSocket + accounts) · `server/db.js` (SQLite) · `server/admin.js` (admin CLI) · `start.bat` (Windows launcher).

## Done (newest first)
- Graphics overhaul step 3: ivy/moss on stone. World-space noise patches (thicker on top faces) drawn with smaller curly green glyphs (`WG_MOSS`) inside the same stone shader.
- Graphics overhaul step 2: high ground. Walkable platforms (`addPlat`/`standAt` in `src/core.js`, colliders take an optional `top`), a watchtower with a spiral stair at `TOWER` (18, -26) in `src/world.js`; `P.high` drives a camera zoom-in (`cam.hk` in `src/main.js`). Enemies still use terrain height only.
- Graphics overhaul (from a reference video), step 1: world-anchored letters on stone. `MID.STONE` materials get triplanar letter text in the scene pass (`worldGlyphs` in `src/core.js`, letter size `WG.cell`), tagged `MID.TEXT` (.925) and passed through by the ASCII pass. Next steps: high ground (tower + camera), ivy/moss, fine grass + night palette, horse, water reflections.
- Whole project translated to English (code, comments, UI, docs). Renamed: `baslat.bat` → `start.bat`, `docs/GELISTIRME-NOTLARI.md` → `docs/DEV-NOTES.md`, `docs/STIL-REHBERI.md` → `docs/STYLE-GUIDE.md`, backup folder `server/data/yedek` → `server/data/backups`.
- v0.8 SQLite (`server/db.js`, node:sqlite, `server/data/terra.db`), automatic users.json import, recovery code + "Forgot password", `server/admin.js` (list/reset/ban/unban/delete --yes/backup), daily backups (last 7), login limit 5/min, closed the uppercase `/SERVER` path leak. VS Code: qwtel.sqlite-viewer installed.
- Shield on Alt (Ctrl was dropped because of Ctrl+W). While blocking, the arm shield (`r.shield`) hides and a copy in front of the chest (`r.shieldFront`, on the spine) shows. Camera drags with the right or middle button.
- MIT license, screenshot in the README (docs/screenshot.jpg). Duel/party/shared-quest and DB/password-reset plans written into ROADMAP Phase 5.
- v0.7 Esc/P pause menu (single player freezes the world; online the player is invulnerable).
- v0.6 Shield (block + parry + stamina), accounts (sign up/log in/guest, scrypt, tokens, server saves).
- v0.5 Multiplayer: host-authoritative co-op, chat, host handover, fallback tick for background tabs.
- v0.4 Animation v2 (combo, roll, jump=Space, roll=C), Misty Swamp + ghoul/witch/troll, camera drops to the horizon.
- v0.3 Detailed knight/monster models, dragon, shadows, particles.
- v0.2 Everything ASCII, modular code, public repo, README EN/TR, sponsor links.

## Open / next
- Next: parties (v0.9) → shared quests (v0.10) → duels (v0.11), details in ROADMAP Phase 5.
- The user said multiplayer "could not be entered": sign up/log in/play tested fine with the Node server. Started with the Python fallback or by opening index.html directly, there is no online mode. How the user launches it is still unclear.
- Sword/whirlwind hits in multiplayer still need a manual test (two tabs).
- Shield-in-front pose: user has not confirmed the latest version.
