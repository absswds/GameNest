# Lobby, AI, And Animation Refresh Design

## Goal

Ship a second visual and gameplay polish pass for the LAN tabletop platform that fixes the weakest current presentation issues:

- replace the fake-looking text-heavy fallback covers with realistic game artwork
- redesign the lobby and room surfaces so they feel like one intentional product
- improve representative AI opponents so they feel smarter and less random
- add tasteful motion where state changes currently feel flat

This pass should make the product look better immediately while also setting up a repeatable pattern for future game-by-game polish.

## Current State

The current `codex/ui-visual-refresh` branch already improved the overall lobby and room shell, but it still has three visible gaps:

1. **Cover inconsistency**
   - six featured games use good bitmap covers
   - the remaining games fall back to tiny generated SVG poster cards with text
   - the result feels stitched together instead of curated

2. **UI polish gap**
   - the current lobby information architecture is better than the original version, but it still reads more like a management screen than a polished game hub
   - the waiting room uses the new shell, but it does not yet feel premium or especially game-like

3. **Gameplay feel gap**
   - several bots still depend too much on random choice or shallow heuristics
   - many state changes happen instantly with little feedback outside a few stronger renderers like `flightchess`, `chinesechess`, `sheeptile`, and `suikabattle`

## Product Direction

The target mood is:

- **realistic enough to feel premium**
- **clean enough to stay readable on mobile**
- **warm enough to feel social**
- **structured enough to keep room creation and joining fast**

Visually, this is a midpoint between a tabletop club and a modern multiplayer lobby:

- realistic tabletop photography or realistic tabletop-render style artwork
- restrained metallic or warm accent usage
- compact interaction density on mobile
- clearer grouping between "pick a game", "join a room", and "continue a room"

## Approach Options

### Option A: Full realistic bitmap coverage now

Generate or replace every cover with realistic bitmap art in one pass, then tune the lobby and room around the new media.

**Pros**
- fixes the ugliest issue directly
- gives the lobby a cohesive first impression

**Cons**
- highest asset volume up front
- slower to iterate if the UI still changes afterward

### Option B: UI-first, then assets

Finalize the lobby and room layout first, then generate the final cover set to match the new card proportions and emphasis.

**Pros**
- less risk of generating the wrong crop/composition
- faster on layout iteration

**Cons**
- the current ugly covers remain visible longer
- harder to evaluate the final experience while the visuals are still weak

### Option C: Hybrid staged pass

Replace the covers for all visible games in the lobby while simultaneously redesigning the main lobby and room sections, then use that stronger shell as the base for AI and animation upgrades.

**Pros**
- best user-visible improvement per round
- avoids spending a whole phase on one layer only
- keeps the system cohesive

**Cons**
- requires tighter sequencing
- more moving parts inside one stage

**Recommendation:** Option C.

This gives the fastest real improvement without forcing a giant all-at-once rewrite.

## Scope

### In scope

- shared catalog cleanup for final cover metadata
- replacing all currently fake-looking lobby cover assets with realistic bitmap art
- upgrading lobby hierarchy and room surface design
- improving representative bots with the highest visible quality gap
- adding or refining animations in shared shell flows and a few representative games

### Out of scope for this pass

- rewriting every bot to search deeply
- re-theming all 22 individual game boards
- changing server protocols for room creation or state sync
- reworking Android-specific packaging

## Experience Design

### Lobby

The refreshed lobby should have four clearly distinct zones:

1. **Top utility band**
   - continue existing room
   - room-code join
   - current reachable LAN URL or QR hint

2. **Featured stage**
   - 4-6 large featured games with realistic covers
   - stronger emphasis on "start from here"
   - one selected game highlighted with clear create action

3. **Browse grid**
   - denser, more scan-friendly cards
   - smaller secondary cards with real media and strong category/player metadata
   - better mobile two-column behavior wherever text still fits cleanly

4. **Quick create dock**
   - persistent primary action
   - reflect selected game instantly

### Waiting Room

The room should feel like a pre-match lounge, not a generic settings page:

- larger key art and title pairing
- clearer roster hierarchy
- better separation between host controls and player readiness
- a more attractive QR/join instruction block
- stronger room identity through cover, subtitle, and meta

### In-Game Shell

The shell should support renderers without overpowering them:

- clearer top summary
- polished transitions from waiting room to game state
- more graceful restart / end state surfaces
- subtle animated status feedback for room events and phase changes

## Cover Art Direction

All replacement cover assets should follow these rules:

- realistic tabletop materials
- readable subject at card size
- no overlaid title text
- no watermark
- no surreal collage look
- no abstract icon-only posters
- consistent lighting family across the set

Two asset tiers:

1. **Featured tier**
   - richer, more cinematic tabletop scenes
   - used in hero or featured cards

2. **Catalog tier**
   - slightly simpler, still realistic scenes
   - optimized for dense browse cards

The shared catalog keeps one cover path per game for now, but the media should be chosen so it crops acceptably across both featured and browse contexts.

## AI Improvement Strategy

This pass should target bots where shallow randomness is most visible.

### First wave

- `texas`
  - improve preflop and postflop strength estimation
  - make bet sizing and fold/call/raise decisions less arbitrary
- `gomoku`
  - improve tactical prioritization for open fours, double threats, and stronger tie-breaking
- `davinci`
  - reduce obvious random guessing and improve target selection
- `oldmaid`
  - replace pure random target/card choice with lightweight memory or heuristic play
- `numberbomb`
  - keep it simple but remove sloppy fuzzy guessing that hurts credibility

### AI principles

- feel smarter before becoming complex
- prefer deterministic heuristics with small optional variation
- avoid long compute or protocol changes
- add focused tests where behavior changes are concrete and stable

## Animation Improvement Strategy

This pass should focus on clarity-enhancing motion, not decorative motion.

### Shared flow animation

- selected game card emphasis
- room join / create success transition
- waiting-room player ready state change
- start-game transition from room to board

### Representative game animation upgrades

- `monopoly`
  - clearer money / rent / build feedback
  - better chance-card reveal treatment
- `texas`
  - card dealing / reveal / action emphasis
- `uno`
  - discard and turn-state feedback improvements

### Animation principles

- short duration
- readable on mobile
- avoid blocking input longer than necessary
- motion should explain state change

## Technical Design

### Shared data

Keep using `public/js/game-catalog.js` as the single metadata source, but evolve it to store:

- final bitmap cover path per game
- featured priority / grouping
- short room subtitle text where needed

### Frontend files expected to change

- `public/index.html`
- `public/game.html`
- `public/style.css`
- `public/js/game-catalog.js`
- `public/js/room-client.js`
- selected renderers under `public/js/renderers/`
- selected bots under `bots/`

### Asset pipeline

- keep generated final assets in `public/assets/game-covers/`
- replace SVG fallback posters with bitmap assets for every game shown in the catalog
- legacy SVG poster assets may remain on disk temporarily, but the catalog default experience must point to bitmap covers instead

## Verification

This design is complete only when current evidence can show:

- all visible catalog games use realistic bitmap covers by default
- lobby works on desktop and mobile with improved scanability
- room screen feels visually upgraded and still supports join / ready / host flow
- representative AI upgrades are in place and verified by focused tests
- representative animation upgrades are visible in runtime checks
- the server still starts and room flows still work

Verification should include:

- focused bot tests where behavior changed
- existing relevant game tests such as `node tests/monopoly.test.js`
- syntax checks for touched frontend files
- manual browser verification for lobby and room flows

## Delivery Plan

Implementation should proceed in three stages:

1. **Stage 1: Covers + lobby/room shell refresh**
2. **Stage 2: representative AI improvements**
3. **Stage 3: shared flow + representative game animation upgrades**

Each stage should be committed separately so the branch stays reviewable and reversible.
