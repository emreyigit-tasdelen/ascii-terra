# Visual Style Guide

Reference: a dark, atmospheric ASCII MMORPG look (rules distilled from the development videos that inspired the project).

## Golden rule
**Every pixel on screen is part of a glyph.** Nothing is drawn as a "direct" 3D image;
grass, armor, water, fire and rain are all made of characters. The HUD is monospace text too.

## Overall feel
- Dark, cold, twilight palette; dim even by day. Warm colours only for fire, torches and magic.
- Camera tilted ~55° from above, facing north by default.
- The cursor is a `+` on screen; the character attacks toward the cursor.

## Glyph sets by material
Each material writes its ID into the render target's alpha channel (`src/core.js` → `MID`); the ASCII pass (`src/render.js`) picks a set from it:

| Material | Grid | Glyphs / colour |
|---|---|---|
| Grass | per blade | every blade is a thin stroke (rendered as it is), teal-to-green palette, dense; white `o *` flowers |
| Flower | normal | white `o * + .` |
| Ground | normal | sparse ` . , : ; '`; stone set on bluish ground |
| Stone (walls, menhirs, rocks, houses) | normal | small screen-grid letters `oaeswqpdbmOQ0&%$#@MW`, blue-lavender, dim; world-space moss patches become green leaf glyphs |
| Wood | normal | `. : - = \| # H` |
| Foliage | normal | `. , ; : * o % & 8 @ #` dark pine green |
| Water | normal | black base, white foam parallel to the shore `- ~ = *` |
| Fire | normal, flickers | orange `. * + o % # & @` |
| Bright thin object (shard, window, web) | normal | `+ x * # @` |
| Rain | normal | `/ '` |
| Character (knight, NPC, skeleton) | fine (0.65x) | armor set `. : ; + = x o O 0 Q 8 % # @` |
| Creature (wolf, spider) | fine (0.65x) | fur: short hair strokes across the shading gradient |
| Chainmail | normal, staggered rows | ring glyphs `o 8 S`, every other row shifted half a cell |

Thin objects (rain, webs, flowers) stamp their glyph on a cell if they touch even one of its 9 samples, so 1-pixel lines never vanish.

## Characters
- **Torvan (player):** silver plate armor + visored helmet, red tabard and shield, sword.
- **Skeleton warrior:** bone white, rusty sword. **Wolf:** grey fur, red eyes.
- **Boss — The Gloomweaver:** giant spider, white webs around it, orange AoE warning circles on the ground.

## HUD
- 10-slot hotbar at the bottom with HP (red) and XP (gold, segmented) bars above it; `LV n · x / y XP` in the middle.
- Target box at the top (`Name hp/max` + thin white bar); a wide, 4-segment red bar for bosses.
- `Name · lv n` and a thin health bar above enemies. Damage numbers white / red, crits yellow.
- Font Consolas, 9–11 px, with shadow.
