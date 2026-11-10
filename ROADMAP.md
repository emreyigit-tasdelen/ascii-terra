# ASCII-Terra — Roadmap

Goal: a **knight world** woven from characters, with the look of a dark, atmospheric ASCII MMORPG;
first a solid single-player ARPG, then multiplayer (MMO). Visual rules: [docs/STYLE-GUIDE.md](docs/STYLE-GUIDE.md).

Status marks: `[x]` done · `[~]` partial · `[ ]` to do

---

## Phase 0 — Foundation (v0.2)
- [x] Modular code: `src/core.js`, `render.js`, `world.js`, `models.js`, `actors.js`, `game.js`, `main.js`
- [x] ASCII renderer v2: material ID (alpha channel) → per-material glyph set; everything on screen is a glyph (directional grass glyphs, characters on a fine grid)
- [x] Pixel-aligned glyph atlas (generated at cell size, crisp)
- [x] Fixed top-down camera, mouse aiming, drag to rotate
- [x] Knight Senje (armor, tabard, sword, shield), walk/attack animation, dodge roll
- [x] Village, castle ruins (walls, towers, arched gate, torches), coastal menhirs, foamy sea
- [x] Enemies: skeleton warrior, wolf, boss Dusk Widow (orange AoE warning circles)
- [x] Skills: sword, fireball, whirlwind, potion; hotbar + cooldowns
- [x] 5-quest starting chain, inventory/equipment, saving (localStorage)
- [x] Public GitHub repository, README (EN + TR), sponsor links
- [ ] Vite dev server and build (bundle three.js locally to drop the CDN dependency)

## Phase 1 — Visual fidelity (match the reference videos)
- [x] Real shadow map (character, wall, tree shadows); grass receives shadows too
- [x] World-anchored letters on stone (big near the camera), ivy/moss glyphs, dense fine-grid grass, planar water reflections
- [x] High ground: watchtower with spiral stair, camera zooms in on high ground; horse mount
- [ ] Coastal mist/haze particles, foam curls on the sea, wave animation
- [x] Fire/ember/blood/bone/spark particles, fireball trail, blood decals, hit-stop and camera shake
- [x] Detailed models: plate-armored knight, dark knight, anatomical skeleton, giant wolf, hairy giant spider, winged dragon
- [x] Animation v2: spring joints, combo, roll, jump, hit reaction, cape physics, creature gaits, jointed dragon
- [ ] Bloom-like glow, skinned mesh animation, foot IK (foot placement on slopes)
- [ ] Lightning/ice/purple magic effects (video: New skills)
- [ ] Per-material grids: chainmail `o8o8` pattern, dragon scales, spider hair (custom grid + symbol)
- [ ] Dynamic weather: rain splashes, wet ground sheen, fog, snow; weather cycle
- [ ] Day/night tuning, torch light radii, moonlight
- [ ] Richer tree and rock models, leaves swaying in the wind
- [ ] Quality settings menu (cell size, grass density, resolution scale)

## Phase 2 — Core gameplay
- [x] Combat feel: hit-stop, camera shake, 3-hit combo, shield block + parry + stamina
- [ ] Directional strikes, enemies that block too
- [ ] Skill system + support gems for builds (video: skills & support gems)
- [ ] Mana / stamina, skill tree, classless — item-driven builds
- [ ] Equipment slots: Weapon, Helmet, Pauldrons, Chest, Gloves, Legs, Boots (video: craft screen)
- [ ] Crafting: metal choice (Iron, Steel, Bronze, Silver, Gold, Moonsteel, Nightglass, Bloodiron, Bonestone, Emberstone) + rune slots + enchantments
- [ ] 3D ASCII item preview on the craft screen (rotatable)
- [ ] Loot tables, rarity colours, item labels on the ground (e.g. "Rusty Stiletto")
- [ ] Mouse-driven inventory grid, drag and drop
- [ ] Enemy AI: groups, archers, casters, fleeing/flanking; boss phases
- [ ] Character creation screen (appearance, name)

## Phase 3 — World
- [ ] Procedural generation from a map sketch (video: map sketch pipeline): biomes, rivers, roads
- [ ] Starting tutorial area + first village (video: tutorial area)
- [x] Misty Swamp region (chapel, graveyard, camp, fog) + region titles
- [ ] New regions: snowy mountains, desert ruins, dungeons (interiors)
- [ ] NPC routines (day/night), merchant, blacksmith, inn
- [ ] Sound and music: footsteps, sword, fire, rain, ambience (video: Added sound)
- [ ] Streaming for a large world (chunk loading), far-distance LOD

## Phase 4 — Content
- [ ] Main story and quest chain, dialogue tree system
- [x] Ghoul, swamp witch (ranged), swamp troll (elite), dark knight, dragon
- [ ] Bestiary: skeleton archer, giant spider variants, horses/mounts
- [~] Bosses: Dusk Widow and Ash Dragon (fire breath + tail swipe) added; phases and the Castle Lord to do
- [ ] Achievements, titles

## Phase 5 — Multiplayer (MMO)
- [x] Dependency-free Node.js server (static + WebSocket), player presence, chat, host election and handover
- [x] Host-authoritative co-op: enemy snapshots, hit/kill routing, shared boss telegraphs and witch hexes
- [ ] Fully server-authoritative simulation (enemy AI on the server, fixed tick), anti-cheat
- [~] Player sync (15 Hz + smoothing) done; prediction + reconciliation, area-of-interest (AOI) filter to do
- [x] Chat
- [ ] PvP duel invites ("X challenges you to a duel", video), parties, shared quest progress
- [x] Account system (sign up/log in, scrypt, tokens, remember me), server-side saves
- [x] SQLite database (node:sqlite), password reset with a recovery code, admin.js, daily backups
- [ ] Anti-cheat
- [ ] Scaling: region servers

### Phase 5 detailed plan — Duels, parties, shared quests

**Shared groundwork (first):** `party` and `duel` state on the server (in memory, keyed by player ID); new message types in
the `net.js` client: `invite`, `invite_reply`, `party_*`, `duel_*`. Invites expire after 20 s, one pending invite at a time.

**1. Parties (v0.9)**
- Stand near a player + `G`, or `/invite <name>` in chat → they see "X invites you to a party [Y/N]".
- Up to 4 members; when the leader leaves, leadership passes to the next member; `/leave` to quit.
- HUD: party member names + health bars on the left; member dots on the map.
- Party members cannot hit each other; members in the same area share kill XP (split evenly, +10% party bonus).

**2. Shared quest progress (v0.10)**
- Quest progress is party-wide: when the leader accepts a quest it is added for every member.
- "Kill N enemies" counters are shared within the party; the host sends `partyId` with each kill report.
- On turn-in each member gets their own reward; a player leaving the party copies the current progress into their own save.
- The database stores quests per player; the party only exists at runtime.

**3. PvP duels (v0.11)**
- `/duel <name>`, or look at a player and press the duel key → "X challenges you to a duel [Y/N]".
- On accept: 3-2-1 countdown, an ASCII ring on the ground (radius ~12 m); leaving the ring loses.
- Only the two duelists can damage each other; health never drops below 1, whoever reaches 1 loses (no death or item loss).
- The result is announced in chat; win/loss counters in the database.
- Anti-cheat: duel damage passes server-side range + cooldown checks.

**Test:** two browser tabs (one private window): invite/accept/decline, party XP sharing, duel ring and result.

### Phase 5 detailed plan — Database and password reset (done in v0.8)
- **Storage:** Node's built-in `node:sqlite` module (Node 22.5+; no dependencies), file `server/data/terra.db`, WAL mode.
  Tables: `users(key, name, salt, hash, rec, created, last, banned)`, `saves(user, data JSON, updated)`,
  `tokens(hash, user, exp)` (only the SHA-256 digest of a token is stored), `stats(user, duel_w, duel_l)`.
  An existing `users.json` is imported automatically on first start and kept as `users.json.bak`.
- **Efficiency:** prepared statements; saves are batched for 1.5 s and written in one transaction.
- **Security:** scrypt; per-IP login rate limit (5 attempts/min); tokens last 30 days; daily `terra.db` backup (last 7).
- **Password reset (no e-mail, no personal data):** a 12-character **recovery code** shown once at sign-up
  (only its digest is stored). "Forgot password" → name + recovery code + new password; a new code is issued after use.
- **Administration:** `node server/admin.js` command-line tool: `list`, `reset <name>` (temporary password), `ban/unban <name>`,
  `delete <name> --yes`, `backup`. No web admin panel (to avoid opening attack surface).

## Phase 6 — Release
- [ ] Desktop package (Tauri/Electron), Steam page
- [ ] Settings menu, key rebinding, gamepad
- [ ] Localization (EN / TR)
- [ ] Performance profiling, low-end hardware mode

---

## Next sprint (suggested)
1. Parties (v0.9)
2. Vite dev server and build
3. Equipment slots and a first version of the craft screen
