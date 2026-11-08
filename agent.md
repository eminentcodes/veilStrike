# Veilstrike development log

Requested cadence: update this file at least every 15 minutes during active development. Times use Africa/Lagos (UTC+1).

The latest specification is **2026-11-05 — Character roster, upgrades, and Embers** below. It supersedes older roster and currency descriptions. Earlier log entries remain as historical implementation notes.

## 2026-11-03 15:25 WAT

- Goal: upgrade the existing fighter into Souls-like 3D arena combat with distinct weapons, multiple environments, stronger effects, better animation, smart AI, and real PvP.
- Audited the React, Phaser, Three.js, combat data, model loader, audio system, and Flaunch integration.
- Baseline `npm run typecheck` passed.
- Existing combat constrains movement to one horizontal axis. Multiplayer currently uses `createMockRoom` to score local events.
- Existing characters share KayKit models. The renderer uses hard-coded bone names and generic animation matching, despite an existing rig adapter.
- Read the supplied X post through the public X embed and FxTwitter. It lists animation/3D/audio tools, including Three.js, Blender MCP, Motion, postprocessing, and Three.quarks.
- Verified the Loadout jam rules through a public page reader. Entries close 6 November 2026 at 15:00 UTC (16:00 WAT). Actual gameplay clip of at least 15 seconds must tag @loadoutprotocol. Judging: gameplay 40%, originality 25%, execution 20%, development plan 15%. Existing AI-assisted games qualify; a token launch is optional.
- Direction: build a shared 3D combat simulation first, with stamina, dodge invulnerability, telegraphed attacks, and AI that reacts to observed actions; use that simulation for an authoritative PvP room server.
- The exact “Soul Bound” reference has not been identified. Current working interpretation is Souls-like combat, based on the request for a less flat game and smart opponents.
- No submission or public posting has been made.

Next log update due by 15:40 WAT.

## 2026-11-03 15:40 WAT

- Added `duel/catalog.ts`: six champion loadouts and three arena themes (Ashen Sanctum, Cinder Forge, Drowned Grove).
- Added a shared arena combat simulation: two-axis movement, stamina/sprint costs, directional weapon reach, attack startup/active/recovery, dodge invulnerability, guards, parries, guard breaks, combos, signature abilities, ultimates, and best-of-three rounds.
- Added delayed-observation AI with difficulty-specific reaction times, spacing, stamina recovery, flank movement, defensive responses, and recovery punishes.
- Added `ChampionRig.ts`: cached model loading, actual skeleton resolution, named combat clips, animation blending, distinct 3D weapons and armor attachments.
- Added a full 3D environment renderer with a following camera, three environments, bloom, attack telegraphs, particle impacts, slash trails, shockwaves, and damage numbers.
- Added keyboard/mouse input handling with reset on blur and separate local PvP controls.
- Added a GLB inventory utility. Confirmed each KayKit model ships with 75 clips and `handslot.l`/`handslot.r` attachments; the previous renderer missed those names.
- Dependency installation exposed pre-existing undeclared Howler/Rapier imports. Adding the required runtime packages so a clean install builds reliably.
- New systems are being connected to the app. Functional/browser checks are still pending; these entries are implementation progress, not claims of completed validation.

Next log update due by 15:55 WAT.

## 2026-11-03 15:54 WAT

- Replaced the old app flow with live 3D menu/loadout previews, six champion choices, three arenas, AI difficulty/opponent selection, local PvP, and a private online room lobby.
- Connected the new match screen: health, stamina, soul charge, abilities, round results, mouse/keyboard/touch controls, target lock, pause and input cleanup.
- Added a WebSocket room server. It validates/clamps player input and runs shared combat authoritatively at 60 ticks per second, broadcasts state, waits for both models to load, and handles disconnects and room expiry.
- Added one-command development startup for both the web app and PvP server, plus separate server build/start commands.
- Declared the existing Howler/Rapier dependencies; added WebSocket support and browser verification tooling.
- Production build passed. Nine combat/server tests passed, covering attack timing, arcs, dodge invulnerability, parry, guard break, stamina/ultimate gating, rounds, AI behavior, and two real synchronized PvP clients.
- Fixed UTF-8 BOM output that disrupted Vite's package/config loading on Windows.
- Browser verification caught an unbound `isMuted` initializer before the menu rendered; corrected it. Visual and browser interaction verification continues.

Next log update due by 16:09 WAT.

## 2026-11-03 16:21 WAT

- New direction from the user: remove local duels, add more arenas, add locked fighters purchased with earned in-game coins/points, improve audio, and give fighters more natural movement plus specialized battle effects.
- Preserve AI duels and authoritative online PvP. Expand the progression and presentation systems around them.
- Existing audio manifest has no samples or music files; all sound currently falls back to synthesis. Audio work will add a richer arena sound layer and weapon/ability-specific voices.
- Browser reached the new menu/loadout with no application errors and captured screenshots. The interaction check needs its button selector adjusted because the visible arrow is included in the accessible button name.
- No new external character pack has yet been imported. Investigating compatible animated character assets and the Blender/Three.js creation route supplied by the user.

Next log update due by 16:36 WAT during active work.

## 2026-11-05 — Character roster, upgrades, and Embers

### User direction and current authorization

- The previous character replacements were not satisfactory. Design ten more distinctive fighters.
- The user initially required ideating all ten before physical character development. This discussion established their identities, selected abilities, access tiers, progression, and currency.
- The user requested documenting the entire discussion in this file, then explicitly authorized moving into character development when documentation is finished, and said to continue. Complete the documentation and proceed with development.
- This section records design decisions and proposals, not claims that characters, animations, progression, rewards, or purchases have already been implemented.
- Preserve the previous development log and unrelated working-tree changes. The new roster replaces the historical six-fighter target.
- Soul-bound is the game's theme, not a requirement that every fighter be a spirit or have a soul-based power. Include human fighters, assassins, demons, a sorcerer, and supernatural fighters.
- Mortal Kombat is an inspiration for impactful combat, memorable special moves, and currency style. Build original character identities around the selected concepts.
- Aim for distinct silhouettes, weapons, movement, personalities, readable abilities, and meaningful weaknesses.
- Rendering style remains open: dark stylized 3D, realistic dark fantasy, and anime-inspired dark fantasy were offered without a selection. The existing game renders in 3D.

### Current roster: exactly ten characters

**Three Basic, four Premium, three Legendary.** Tier and character level are independent.

| Character | Tier | Identity and access |
|---|---|---|
| Karen | Basic | Free starter 1; human swordfighter with throwing blades |
| Taren | Basic | Free starter 2; human shield-and-spear warrior |
| Nomet | Basic | Free starter 3; undead hand-to-hand brawler |
| Veyra | Premium | Human huntress with a launched chained dagger |
| Mawren | Premium | Sorcerer using bolts, charged runes, and a ward |
| Neris | Premium | Human assassin with daggers, tripwires, and smoke |
| Vesper | Premium | Combat physician/assassin with needles and poison marks |
| Rhoven | Legendary | Cursed human assassin who periodically becomes particles |
| Seyra | Legendary | Spirit fighter whose temporary second body separates, fights, and rejoins |
| Varkesh | Legendary | Furnace demon with a transforming, throwable molten fist |

- Karen, Taren, and Nomet are free at the beginning, in that order. Taren fills the previously undecided second starter slot.
- Seven Premium/Legendary fighters unlock with in-game currency or money. Money prices and payment mechanics remain undecided.
- Use **Nomet**, the user's current spelling; the first draft called him Nemet.
- **Karen replaces Oru**. Oru is removed, not an eleventh character.
- **Vesper** is the current working replacement name proposed for **Amara**, included in the roster the user subsequently accepted.
- All characters start at Level 1 when obtained and can reach Level 3.

### Character specification

Core selections below should be preserved. Move names, numerical damage, durations, cooldowns, and detailed balance are proposals to tune.

#### Karen — The Blade Fighter

- **Basic, starter 1.** Straightforward human fighter designed for beginners.
- Proposed appearance: athletic woman in practical leather armor, with a sword and throwing blades secured at her waist.
- Quick sword slashes, a heavier finisher, accessible combos, balanced movement, and reliable defense.
- **Blade Toss:** simple ranged throwing-blade attack.
- Weakness: moderate reach/damage and a brief opening after throwing.
- Explicitly replaces Oru's beast identity and all ancestral transformations.

#### Taren — The Iron Oath

- **Basic, starter 2.** Grounded human shield-and-spear warrior.
- Weathered soldier, practical armor, repaired tower shield, and short spear.
- Precisely timed blocks build momentum for a shield charge and spear counterattack.
- Strong guard, defensive timing, counters, and pushing opponents backward.
- Weakness: slow pursuit and exposed flank after missed charges.
- Latest kit uses physical weapon mastery; the earlier dead-brother possession/armor transformation was exploratory and is superseded.

#### Nomet — The Gravebreaker

- **Basic, starter 3.** User accepted the Mortal Kombat-inspired brawler replacement.
- Undead pit fighter: muscular humanoid build, grey scarred skin, iron wrist guards, exposed bone along one forearm. Uses fists, elbows, knees, and grabs.
- **Grave Fist:** punches the floor; a large skeletal fist erupts a short distance ahead and uppercuts the opponent. Cracks telegraph its emergence.
- **Ribbreaker:** slow, powerful body punch with knockback.
- **Burial Drop:** grabs, lifts, and slams the opponent.
- **Last Burial, ultimate:** body blows, rising uppercut, and downward slam.
- Visual signature: arm bones glow; the erupting skeletal fist mirrors his punching motion.
- Weakness: slow recovery after missed heavy attacks; poor pursuit.
- Old funeral bell and delayed shockwave rings are superseded.

#### Veyra — The Chain Huntress

- **Premium.** User chose a dagger with chains that she launches at the opponent.
- Human weapon master; dagger chain secured at her forearm. Launch, hook, retract, and control engagement distance.
- **Chain Pierce:** straight dagger launch; successful hit briefly hooks the opponent.
- **Reel In:** pulls the hooked opponent toward her for a close-range combo.
- **Hunter's Rush:** pulls herself toward the hooked opponent, finishing with a knee strike.
- **Returning Fang:** sweeping dagger recall that can hit along its return path.
- **Captive Steel, ultimate:** chain restraint, forward rush/precise strikes, backward throw, dagger retrieval.
- Show the chain uncoiling, tightening on a catch, and whipping back around her arm. Give her distinct chain-handling stances and animations.
- Weakness: missed launches expose her during retrieval; launch can be dodged or blocked.
- Premium value comes from specialized play, positioning, follow-ups, and presentation.
- Previous articulated sword, whip blade, and double-ended meteor hammer proposals are superseded.

#### Mawren — The Rune Sorcerer

- **Premium.** User changed the demon grappler into a sorcerer with magic.
- Proposed staff, rotating inscriptions around hands/weapon, and runes brightening before activation. Species, costume, and detailed backstory remain open.
- **Arcane Bolt:** concentrated magic projectile.
- **Rune Seal:** visible ground rune; hitting it with Arcane Bolt activates an eruption.
- **Arcane Ward:** brief forward barrier.
- **Rune Collapse, ultimate:** a large seal draws in the opponent and detonates; pull behavior/counterplay need tuning.
- Focus on spell timing and rune placement.
- Chest-mouth, projectile swallowing, Bound Hunger lore, and chain grappling are superseded.

#### Neris — The Silent Hunt

- **Premium.** Human assassin using speed, preparation, and deceptive movement.
- Proposed silver cropped hair, asymmetrical dark coat, hooked daggers, concealed traps.
- Tripwires briefly disrupt opponents, opening a lunging follow-up; smoke conceals repositioning. Traps have readable clues.
- Weakness: fragile in direct combat and needs preparation time.
- Current kit is weapons/traps/smoke. Earlier name-stealing soul lore and independently hunting detached shadow were exploratory and are superseded.

#### Vesper — The Crimson Physician

- **Premium.** Working name replacing Amara.
- Human combat physician/assassin with needle weapons and poison combinations.
- Proposed bone-white coat, inked hands, medicine vessels, and long surgical needles.
- Needle hits apply poison marks; a precise finisher activates accumulated marks for burst damage.
- Weakness: requires repeated accurate hits; limited immediate stopping power.
- Current identity is precision and poison. The original mandatory dead-patients soul bond and self-health-sacrifice kit were exploratory.

#### Rhoven — The Unravelling

- **Legendary**, explicitly assigned by the user.
- Cursed human assassin with worn clothing, glowing fractures, and a proposed physical/spectral blade pair.
- **Selected core:** periodically transforms from a human body into particles, disperses briefly, then visibly reforms.
- Sequence: fractures and escaping body/clothing fragments; full dark-particle body around a luminous core; reconstruction of outline, body, and clothing, with feet touching down last.
- Proposed signature detail: human shadow lingers after the body vanishes.
- Proposed play: guide cloud a short distance; no attacks while dispersed; brief vulnerable reformation. Use actual particle transformation, not simply toggling model visibility.
- **Scatter** proposal: activate early, consuming the upcoming automatic phase. **Soulstorm** ultimate proposal: swirling particle form with clearly signaled strikes before reforming.
- Around ten seconds between phases and one second dispersed were suggested, not finalized. Define cooldown versus full-cycle timing before tuning.
- Minor particle loss can vary cosmetically; combat phase must have readable visual/audio cues.
- Interrupted execution, fading memories, and name carved into wrist are optional story details.
- Earlier delayed attack echoes / Split Second identity is superseded by particle transformation.

#### Seyra — The Divided

- **Legendary**, explicitly assigned by the user.
- Spirit fighter with fractured translucent glass body and flowing mourning garments.
- **Selected core: exactly two bodies total, main Seyra plus one temporary double.**
- Double visibly separates, independently moves and fights the same opponent, then returns and merges after a timer. Player controls main; double acts autonomously.
- Separation: overlapping second silhouette pulls sideways through head, shoulders, arms, and legs, then steps free.
- Fight: both are complete animated fighters. Main retains glass appearance; double is luminous/smoky with readable limbs and weapon. Thin soul thread connects them.
- Expiry: timer beside health; double sheds particles near expiry, stops attacking, stretches into fragments along the thread, and enters main body's back/shoulders. Flash marks reunion.
- Proposed starting numbers: four seconds separated, twelve seconds between separations; durations are provisional. Define cooldown versus full cycle explicitly.
- Proposed balance: reduced double damage; opponent can hit it enough to force early reunion. Coordinated pressure should have readable openings.
- Village memories / Last Witness story is optional lore.
- Original attack-copying and three memory bodies/swordsman/guardian proposals are superseded. Upgrades must never add a third body.

#### Varkesh — The Living Furnace

- **Legendary**, explicitly assigned by the user.
- Massive volcanic demon, broken horn, molten skin cracks, armored fists.
- Taking damage builds heat and visibly transforms one arm into an oversized molten fist.
- Heat powers crushing strikes; can detach/throw fist, then gradually regrow arm. Ground eruption was also proposed.
- Weakness: overheating self-damage; missing/regrowing arm temporarily reduces reach and defense.
- Furnace Exile / Cinder Debtor and child-soul restraint ideas remain optional lore, not a required story premise.

### Three-level progression

- **Level 1 → Level 2 → Level 3 maximum.** Two upgrades after obtaining a character, not three upgrades above the initial level.
- Purchase with **Embers**. No automatic XP progression was selected.
- Upgrades permanently apply to the individual character, not all fighters.
- Level 1 has starting performance and signature abilities available.
- Level 2 improves base stats and an aspect of the fighting style.
- Level 3 provides maximum progression performance, further signature improvements, and richer weapon/armor/ability visuals without losing the recognizable silhouette.
- User approved staged performance upgrades. Exact enhancements below are tuning proposals.
- Suggested stat totals relative to Level 1: Level 2 **+5% health, +3% damage**; Level 3 **+10% health, +6% damage**. Level 3 percentages are cumulative totals, not additional bonuses stacked on Level 2.
- Tune stats and signature changes together.

| Character | Proposed Level 2 | Proposed Level 3 |
|---|---|---|
| Karen | Faster thrown-blade recovery | Stronger sword combos and blade damage |
| Taren | Better guard durability | Stronger counters and shield charges |
| Nomet | Faster Grave Fist activation | Stronger grabs and Grave Fist damage |
| Veyra | Faster dagger retrieval | Stronger Reel In / Hunter's Rush follow-ups |
| Mawren | Shorter Arcane Bolt cooldown | Stronger rune eruptions and more durable ward |
| Neris | Faster trap placement/recovery | Stronger trap follow-ups and shorter smoke cooldown |
| Vesper | Longer poison mark duration | Higher mark-activation damage |
| Rhoven | Shorter transformation interval | Faster dispersed movement and reformation |
| Seyra | Higher double damage | Longer double duration; still two bodies total |
| Varkesh | Less overheating self-damage | Stronger molten fist and faster arm regrowth |

### Confirmed currency: Embers

- User's final naming choice: **"lets gowith embers"**. Use **Embers** for balances, rewards, unlocks, and upgrades.
- One main earned currency. No separate premium currency is selected.
- Naming history: Marks, Aether, Embers, Sigils, Obols, Essence, Coins/Koins, Crowns/Krowns, and Crystals. Only Embers is current.
- Aether was explained as a heavenly substance/fantasy magical energy. User preferred Mortal Kombat-style naming, shortlisted Crystals/Embers, then chose Embers.
- Mortal Kombat reference currencies discussed: Koins; Dragon Krystals in MK1; Soul Fragments and Hearts in MK11. These are references, not currencies to implement here.
- Currency icon remains open; glowing embers or ember-like crystal fragments are possible visual directions.
- Proposed earning: completed matches, daily goals, weekly challenges, and one-time achievements. AI matches count so players can progress while learning.
- Match rewards apply to a whole match, not each round.
- Premium/Legendary characters can have direct money unlock options. Money prices, payment provider, currency packs, blockchain/token behavior, and checkout are not selected.

#### Proposed rewards, subject to tuning

| Activity | Embers |
|---|---:|
| Completed match win | 60 |
| Completed match loss | 25 |
| First daily win | 75 bonus |
| Daily objective: complete three matches | 75 bonus |
| Weekly challenges | 200–400 |
| Character mastery achievements | 50–200 once per achievement |
| Introductory tutorial | 100 once |

- Objective ideas: successful blocks, different fighters, and matches with Basic fighters.
- Draws, forfeits, disconnects, repeat-match eligibility, reset rules, AI reward validation, and precise challenge definitions remain unspecified.

#### Proposed prices, subject to tuning

| Purchase | Embers |
|---|---:|
| Karen / Taren / Nomet at Level 1 | Free |
| One Premium unlock | 1,500 |
| One Legendary unlock | 4,000 |
| Level 1 → Level 2 | 300 |
| Level 2 → Level 3 | 900 |

- Proposed full upgrade cost: **1,200 Embers** per character, in addition to unlock cost. Upgrade prices are proposed to be equal across tiers.
- Example: three wins (180), two completed losses (50), first-win bonus (75), three-match objective (75) = **380 Embers**. Excludes tutorial, mastery, and weekly rewards.
- At that example pace: Level 2 in one session, Premium unlock in roughly four sessions, Legendary unlock in roughly eleven sessions.
- Earning rates/prices depend on actual match duration and desired unlock pace. These are estimates, not final economy commitments.

### Development handoff

- Preserve ten characters and the three-tier split; do not restore the older six-fighter target or rejected weapons/forms.
- Preserve selected core mechanics, especially Rhoven's visible timed particles, Seyra's two actual separating/reuniting fighters, Varkesh's molten arm, Veyra's launched chained dagger, and the starter order Karen/Taren/Nomet.
- Keep provisional move details, timings, percentages, and prices identifiable while implementing and testing.
- Final art direction, model/rig sources, animations, sound assets, persistence, reward accounting, unlock UI, payment mechanics, and precise balance still require development decisions.
- **Next authorized step: character development after this documentation is finished.** Inspect the current roster, rigs, renderer, and combat simulation and carry the approved identities into the game. Record actual implementation and verification separately from this specification.

## 2026-11-05 13:40 WAT — Original character development

- User reaffirmed continuing physical character development, with meticulous detail rather than quick replacements. Build each fighter deliberately, including facial anatomy, clothing, actions, and the smallest identity details.
- Every character must portray its actual entity: humans must visibly be humans, with recognizable male/female presentation; undead, spirits, and demons must express their own anatomy and nature. Do not give everybody robotic limbs, identical helmets, armor, colors, size, or shape.
- Clothing and equipment must differ and belong to the individual's skills and identity. Every fighter must have a distinct signature move.
- User supplied `C:/Users/Great/Downloads/SAMPLECHARA.jpg` as visual inspiration in some cases. Inspected the image: grounded dark fantasy, proportional figures, detailed shaped armor, layered cloth, and character-specific restrained magic. This is a visual influence, not authorization to replace the approved identities with the pictured characters.
- Read the supplied reference post: https://x.com/e1genqq/status/2116270712390316375. Relevant references include Blender, Three.js, postprocessing, and particle VFX. The installed paid reader could not retrieve the post; its balance is zero. The public FxTwitter copy succeeded. No paid calls, subscriptions, or image-generation purchases were made.
- Audit confirmed the active catalog still contains twelve superseded fighters and `humanRig.ts` builds nearly identical metal bodies/visors. Existing arena, AI, and authoritative PvP systems will be retained while integrating the approved ten.
- Preparing an original, editable Blender modeling/rigging pipeline, exported game models, unique animation choreography, a close-up character inspection view, and species-specific signature mechanics. None is yet claimed complete or verified.

Next log update due by 13:55 WAT during active work.

## 2026-11-05 15:00 WAT — Deadline, lobby, and audio steering

- User needs a submission today and asked to work promptly. Quality remains important; user prefers Blender for character authoring and Three.js for runtime. Continue other game work during the tool download.
- The first 399,051,129-byte Blender download ended early at 73,564,160 bytes. Eight attempted range requests also failed. Restarted from the official RWTH Aachen mirror, keeping the partial file in Temp. Blender is not yet installed.
- User asked for better combat audio and occasional AI voice cues. The lobby should have a separate quiet background track.
- User requested a Free Fire/CODM-like lobby: one selected fighter in the center, automatic periodic signature choreography, profile card upper left, side controls for mode and character selection, and Play at the lower right.
- Ten approved character definitions now exist in `duel/roster.ts`; catalog exports only the approved ten. Assets, animation integration, signature simulation, and verification remain unfinished.
- Installed edge-tts tooling into the ignored workspace cache for neural announcer asset generation. Added an original reproducible audio pack generator. Beginning lobby and audio integration; no completed validation claimed.

Next log update due by 15:15 WAT during active work.

## 2026-11-07 — Combat correction and premium release steering

- Impact reactions must remain standing and stagger backward. Kneeling is exclusive to fatal defeat. Sustained pressure and high-impact signatures/ultimates collapse onto the ground, with grounded recovery.
- Karen now references a new original anatomical export and midnight-blue tailored coat. Corrected the added panels from Blender Z-up to the skin's glTF Y-up; the earlier mismatched coordinates visibly placed a garment on the floor. Free hand supports the sword wrist; a dedicated relaxed lobby pose is generated. Actual latest screenshots and interface verification remain in progress.
- User clarified that Nomet, not Taren, should have the King Kong-like heavyweight torso and broad arms. Remove the rising skeletal fist. His own fist performs the ground slam; cracks, dust, rubble and camera shake remain. Signature renamed Gravequake.
- Taren retains shield and spear. Improve shield brace, add coordinated shield bash, and a large forward shield force field with nearby-only damage, strong displacement and knockdown. Signature renamed Oath Repulse.
- Rounds increased from 90 to 120 seconds; ordinary damage scale reduced from .70 to .65. Special cooldowns multiply the roster cooldown by .8; charge gain increased slightly. Animated HIGH IMPACT text is being integrated for knockdowns.
- User authorized developing up to two Premium fighters now, with at least 70% similarity in build to the provided SAMPLECHARA.jpg. Reference inspected: three ornate dark-fantasy fighters with layered armor, sculpted shoulder silhouettes, distinctive weapons and limited colored magic. Develop Veyra and Mawren from the approved Premium roster using this silhouette/material direction, with complete actions and actual signature mechanics. Similarity is an art target; no measured percentage is claimed.
- After character work, reduce arenas to five, preserve Ashen Sanctum, and redesign the remaining four with distinct geometry, patterns and atmosphere. The shared circular floor/columns and recolored grove fallback are rejected.
- Last completed checks before the latest ability edits: eight gesture/pose tests, thirteen simulation/WebSocket tests, and typecheck passed. Browser pose inspection loaded the upgraded Karen and validated bone positions but its input check timed out; screenshot camera/pause control requires correction. Do not claim the browser review passed.

## 2026-11-05 17:25 WAT — Karen quality correction

- Blender 4.5.9 is downloaded and extracted (100%). Executable is `.cache/blender/blender-4.5.9-windows-x64/blender.exe`.
- New lobby renders at `http://localhost:5173/`; the last basic browser capture reported no application errors. Full combat interaction validation remains pending.
- Only Karen has a generated Blender GLB. The user rejected its crude face, shapeless clothing, anatomy, and sword grip. That asset is not accepted or complete. Do not expand its rejected design to the rest of the roster.
- Rebuilding Karen using the CC0 MakeHuman anatomical mesh and female/athletic morphs, with fitted dark-fantasy equipment, natural hands, and a proportionate uncovered face. Inspect the replacement portrait and actual live lobby before calling it improved.
- Latest steering: Karen needs a flexible human body, believable sword holding, and living idle behavior in both lobby and combat. User withdrew the request for a side-by-side Three.js comparison; show the upgraded Blender version in the single-character lobby.
- Signature simulation, full jump/grapple/throw mechanics, and a valid CosyVoice voice pack remain unfinished. The earlier procedural audio remains in place and is not presented as approved quality.

Next log update due by 17:40 WAT during active work.

## 2026-11-06 — Combat experience improvements in progress

- Current user direction: improve overall fighting, beginning with distinct character fighting stances and changing postures.
- One Attack control replaces separate light/heavy controls: one press is light, two quick presses are heavy, across keyboard, mouse, and touch.
- Hits must visibly recoil/stagger the opponent, have effects on the body, and noticeable differentiated sounds. AI fighters use the same mechanics and animations.
- Ordinary hits should not immediately topple fighters. Sustained impacts build toward a knockdown, with articulated falling, bracing, and getting up.
- Fatal impact should transition into kneeling surrender; held weapons/shields drop or shatter. Final animations must continue during the round result.
- Nomet should be larger with a more distinctive face, brutal punches, and a visibly powerful ground slam with cracks, ground shake, dust, and special effects. Retain his established Grave Fist identity.
- The user supplied anime.js, Three.js, cannon-es, and Effekseer repositories as supporting resources. The existing Three.js renderer is the current integration point.
- Fighting feels too fast: reduce ordinary health damage. Starting implementation reduces regular attack damage by 30%; ultimate damage is reduced by 15%.
- Implementation and visual/combat verification are underway. No completed validation is claimed in this entry.

## 2026-11-07 — Lobby soundtrack

- Latest audio request: begin with background lobby music, using the user's local `Aylex - Storm (freetouse.com).mp3`, played quietly.
- Copied the supplied recording unchanged into `apps/web/public/audio/music-lobby-storm.mp3` and selected it as the menu track in the audio manifest.
- Retained the existing low lobby gain, looping, fades, music slider, mute, and battle soundtrack transition. Recorded artist/source attribution in the audio README.
- Browser confirmed that the supplied 98.77-second MP3 plays after a click, loops at its end, and responds to the Music slider. Default combined master/music gain is 7.67%.
- Latest steering also requests rich interface sounds for clicks, hover, and the daily spin.
- Generated an original stereo interface pack: soft glass hover cues, padded brass clicks, eight wheel recordings with ratchet ticks timed to the existing easing/rotation, and distinct reward/jackpot chimes.
- Removed duplicate UI listeners from App; AudioProvider now owns mouse-hover and pointer/keyboard activation sounds. Cached effect URLs follow the manifest revision.
- Spin audio stops when the panel closes; its reward sound uses a dedicated cue rather than combat victory audio. Browser interaction and soundtrack transition checks are in progress.

## 2026-11-07 13:32 WAT — Home, first-time onboarding, guide, and AI matchup

- Current request: one-viewport home with Veilstrike, Play Game, FAQs, full game guide, and the exact EMINENT STUDIOUS credit. Prepare the actual lobby asynchronously behind the home before entry.
- First-time players enter a name and choose Karen, Taren, or Nomet from illustrated cards; all three remain free. Add separate first-time lobby and in-match controls tours, remembered on this browser.
- AI duels need a player card, large VS, and an animated random opponent reveal synchronized to the actual match. Render the arena during that screen, then briefly retain Entering the Veil. PvP excludes this reveal and tutorial interruption.
- Audited existing game and local changes. Moved the existing app into a dynamically imported GameLobby without discarding the existing gameplay, progression, audio, or room flow. The new lightweight App coordinates home, guide, setup, and pre-rendered lobby.
- Added profile onboarding flags and selected-fighter persistence with migration of returning profiles. Added home, card setup, FAQs, comprehensive guide, and contextual tour components. Runtime match integration, optimized art, and validation are still in progress; no completed browser or performance validation is claimed.
- Existing style is preserved: navy surfaces, gold actions, Nunito interface text, Georgia wordmark, and square panels. Implementation rationale is in docs/entry-experience.md.

Next log update due by 13:47 WAT during active work.

## 2026-11-07 13:30 WAT — Interface and combat audio integration

- User approved the hover and requested a better click. Kept the hover; replaced the click with a shorter mechanical snap with less ringing.
- User requested richer blows, punches, movement, damage, impacts, falls, game over and win sounds; supplied Spotify Pedalboard and authorized sourcing free packs.
- Downloaded 51 Kenney RPG Audio recordings from the public Boyquotes mirror. Verified and retained its CC0 license. OGGs are in `assets/audio/sources/kenney-rpg`; provenance and license are bundled with the runtime audio.
- Installed Pedalboard 0.9.26 as a cached build tool. Rendered 135 stereo combat files with Foley layers, original low impact/music layers, EQ, compression, reverb, and limiting. No paid service was used.
- Added `DuelSoundscape`: release/contact sounds, grounded-distance footsteps on five surfaces, distinct jump/throw landings, delayed floor/equipment/surrender cues, and one cue per round result. Seven behavior tests passed.
- Cached music/ambience tracks so rapid screen changes preserve their load/fade lifecycle. UI feedback works in visible pause/tutorial menus; combat audio suspends with the game.
- The app/lobby were reorganized concurrently. Integrated audio into `GameLobby`, activated/suspended match audio with its active flag, and preserved the existing tutorial flow. Fixed type errors preventing verification of that flow; typecheck passes.
- Added repeatable audio previews to Audio settings. Asset integrity, browser interaction, gameplay/server and production-build checks are being completed.

- Latest steering supersedes the preview panel: lobby audio settings must contain only **Sound** and **Effects** adjustment. Sound controls the music level; Effects controls interface/combat cues. Removed the master/announcer sliders, previews, credits, and reset action from that panel.
- Production build, asset integrity, seven audio behavior tests, thirteen gameplay/PvP tests, and eight browser interface/music checks passed before this final settings simplification. Final combat/browser verification is being completed.

- Final production build passed with the two-slider settings. Browser verified exactly Sound/Effects, working independent levels, persistence after reload, and silent interface cues at zero Effects; all four checks passed without application errors. Evidence is in `verification/audio-settings.json`.

## 2026-11-07 14:23 WAT — Live home and reveal corrections

- Latest steering: use the live default Ashen Sanctum world behind home, quiet existing theme audio, and one generic loading transition instead of Preparing your lobby.
- The shared fighter card references missing image assets. Fixing portraits for all five currently playable fighters using their actual current models.
- Replace changing opponent names with a fast image-only shuffle and one final synchronized opponent card. Reuse existing spin/reward audio and saved Effects settings.
- Latest brand correction: use Eminent™ for the studio credit, and replace the logo/favicon with a navy and gold emblem. FAQs must state that five fighters are available now and more are coming soon.
- Shared character manifest loading and skipped invisible preview-opponent loading are implemented. Live home integration, portrait captures, and complete browser validation remain in progress.

Next log update due by 14:38 WAT during active work.

## 2026-11-07 14:45 WAT — Spinner visibility and current assets

- User reports the shuffle is not visibly playing in real time. Added a clear rotating indicator and continuous image-only reel, timed after its first paint. Deferring arena construction by two animation frames lets the matchup appear before scene preparation begins.
- Home now shares its live arena renderer with the prepared lobby; docs and obscuring dialogs pause preview work. The generic entry loading curtain waits for a prepared fighter frame.
- New navy/gold emblem, SVG favicon, Eminent™ credits, five-available-fighter FAQ, and current Sound/Effects guide copy are implemented.
- Typecheck passed before the final spinner visibility adjustment. Building real-model WebP portraits and PNG favicon fallbacks with a headless browser; Windows sandbox blocked browser startup, requiring the approved browser workflow outside the sandbox.

Next log update due by 15:00 WAT during active work.

## 2026-11-07 — Neural arena announcer and final 25-second beat

- Rendered 24 deep male en-US-GuyNeural recordings with lowered pitch, EQ, compression, stereo reflections and restrained arena reverb. Bountiq's Desktop/Gentank README identifies the same Edge Neural engine; that checkout does not contain its female preset. Runtime uses local WAVs rather than browser speech.
- Combined round calls reach Fight at 1.025 seconds. Round events now occur at intro start; both simulated fighters and local/PvP gameplay inputs stay held until the spoken marker. Muted or failed voice loads permit the fast intro to finish. The browser measured release at 1.051 seconds and verified movement afterward, plus round two and conditional round three.
- Victory and Defeat use neural speech. Signature/ultimate, guard-break, parry and substantial-impact reactions are spaced apart; final results interrupt lower-priority calls. Effects controls and silences the announcer along with combat/interface audio.
- Latest steering replaces the 40-second opening: Into the Veil is now an original 25-second, 120 BPM composition with syncopated kick/snare, pulsing bass, stereo hats/tom fills, brighter harmonic-minor arpeggios and high string tension. Its final three seconds fade out. It plays once per match, ducks under speech and leaves arena ambience afterward; pausing an expired track does not restart it.
- Preserved the supplied quiet looping Storm lobby track, approved hover, improved click/spin and Kenney/Pedalboard combat pack. Lobby Audio settings contains only Sound and Effects.
- Fixed the cached loading-track pause/fade race and Mawren's AI approach: he now enters rune range before committing to long-range bolts, allowing his signature and its voice cue to occur.
- Final checks passed: 21 gameplay/WebSocket tests, 9 combat-audio tests, 24-clip asset integrity audit, 7 live announcer/music browser checks, 2 failed-download/muted-intro browser checks, forced typecheck and production build. Verified the production output contains the rebuilt 25-second track, all 24 voices, revision combat-rich-v12 and the load-failure fallback. Earlier four checks for the two-slider settings remain valid.
- Evidence: verification/announcer-assets.json, verification/announcer-audio.json, verification/announcer-fallback.json and verification/audio-settings.json. Rebuild instructions and attribution are in docs/arena-audio.md and apps/web/public/audio/README.md.

## 2026-11-07 15:38 WAT — Quick Match and loading correction

- Renamed AI Duel to Quick Match throughout the lobby, matchup screen, HUD, both tutorials, FAQs, handbook, and page metadata. Internal practice-mode identifiers are retained. Updated guide reward and difficulty copy to reflect the current game.
- Completed real-model WebP portraits for all five available fighters, the Ashen Sanctum image fallback, and PNG favicon/touch-icon fallbacks. Inspected the updated Taren capture.
- First-time setup awards 1,500 Embers once, with saved setup/lobby/combat flags and a welcome-gift tour stop. Updated docs/entry-experience.md for the live home arena, Eminent™ credit, loading flow, and current match presentation.
- User reported being stuck on Loading until returning home. Browser reproduced completed setup with no mounted lobby. Removed the low-priority transition from the completed lobby import and added immediate preparation for direct lobby routes. Verification of the correction and combined flow is underway.
- Fresh typecheck, production build, and complete browser checks remain pending.

Next log update due by 15:53 WAT during active work.

## 2026-11-07 16:15 WAT — Percentage loading and network priority

- User requested a visible loading percentage and asked to continue. Added a shared determinate progress bar to lobby entry, arena loading, and the opponent reveal when the arena is still preparing.
- Progress follows completed module loading, actual shared model transfer/parsing, rig installation, and the first rendered frame. Cached/in-flight assets share progress subscribers; combat never starts before readiness.
- Loading diagnosis found the lobby request queued behind eager downloads of the entire audio pack. Limited sound preloading to two requests, prioritizing interface/spin sounds and the first round call. Existing files, soundtrack, effects settings, voice gates, and fallback behavior are preserved.
- Excluded generated type declarations/build metadata from Vite watching after its log showed repeated full-page reloads during typecheck.
- Fresh forced typecheck passed for the percentage loader and bounded audio queue. Full live entry/match verification and production build are next; earlier audio-session results do not verify this final flow.

Next log update due by 16:30 WAT during active work.

## 2026-11-07 16:33 WAT — Mobile controls and landscape steering

- Latest mobile request replaces directional movement buttons with a circular analog joystick. The action controls should be round, arranged as a diamond with diagonal side controls, including signature and ultimate abilities.
- Added requirement: begin automatic landscape handling on the home page and retain it through the lobby and matches. Use the browser orientation/fullscreen APIs when supported, with a nonblocking rotate hint for browsers that cannot lock orientation.
- Audited the existing input, combat HUD, tutorial targeting, responsive layouts, and native-dialog entry flow. Implementing continuous camera-relative joystick input, independent multitouch actions, safe release/reset behavior, and updated guide/tour copy.
- Earlier percentage loading and queued audio changes remain in place. The combined entry flow, new controls, and final build still need fresh verification.

Next log update due by 16:48 WAT during active work.
## 2026-11-07 16:48 WAT — Mobile controls implemented

- Replaced the directional pad with a round analog joystick. Its 12% dead zone, continuous movement strength, and camera-relative axes feed the existing local/PvP input frames; pointer movement updates the thumb directly without React rerenders.
- Added circular action buttons in a diamond/diagonal layout: Jump above, Guard left, Attack right, Dodge below, side Grab/Sprint, and Special/Ultimate above. Ability rings retain actual cooldown/stamina/charge gating. All mobile targets remain at least 44px at 320px width.
- Landscape handling now mounts with home and remains active across game routes. Supported browsers request fullscreen from the first gesture and then lock landscape; unsupported browsers retain responsive controls and a nonblocking rotate hint. Added safe-area support.
- Joystick and actions reset on release/cancel/lost capture, blur, hidden tabs, resize, pause/tutorial, and unmount. Updated the combat tutorial, guide, and lobby controls copy.
- Forced typecheck passed. Replacing outdated browser selectors to validate real first-time loading, saved onboarding, visible opponent shuffle, mobile controls, orientation handling, and PvP exclusion. Production build and final suites remain pending.

Next log update due by 17:03 WAT during active work.
## 2026-11-08 10:12 WAT — Final mobile steering and browser checks

- User removed Guard from mobile. The four main buttons are now an aligned diamond: Jump top, Grab left, Attack right, Dodge bottom. Sprint, Special, and Ultimate sit beside it. Desktop guard/parry inputs remain available; guide and tour copy reflect the mobile change.
- Added repeatable browser checks for first-time automatic entry/percentage progress, saved welcome gift/tours, home renderer reuse, guide/FAQs, live synchronized shuffle, mobile joystick/multitouch/reset behavior, 320px and short landscape layouts, home orientation API ordering, reduced motion, and two real PvP browsers.
- A fresh typecheck and live browser run are starting. No deployment or commit is requested.

Next log update due by 10:27 WAT during active work.
## 2026-11-08 10:30 WAT — Final six-button mobile layout

- Latest user steering removes Jump from mobile and puts Sprint in its top position. Final diamond: Sprint top, Grab left, Attack right, Dodge bottom. Special and Ultimate move to the far-right edge. Keyboard/mouse guard and keyboard jump remain available.
- First browser run passed automatic first-time/direct lobby loading, real percentage progress, starter/collection portraits, the once-only 1,500-Ember setup award, saved lobby tour, 390px/320px/short-landscape circular control geometry, analog dead-zone/strength/clamping, home orientation request ordering, and reduced-motion/unsupported-orientation fallback.
- Correcting a test reference overwritten by the collection inspection renderer, and inspecting simultaneous movement/Sprint timing. Final browser flow is still incomplete; this log does not claim the entire suite passed.
- Fresh typecheck and all nine combat-audio tests passed. Twenty gameplay tests passed, while the local WebSocket test timed out during the heavily loaded browser run. Rechecking it sequentially before the final build.

Next log update due by 10:45 WAT during active work.
## 2026-11-08 10:45 WAT — Verification progress

- Final six-button mobile layout and far-right ability positions are implemented. Fixed ability-ring masking so progress rings no longer cover the icons.
- Corrected browser verification to follow the actual live lobby canvas rather than the inspection preview's overwritten debug reference. Added pointer/input diagnostics and frame-based waits for multitouch checks.
- All 21 gameplay/WebSocket tests passed when rerun sequentially outside the sandbox; the prior timeout did not reproduce. All nine combat-audio tests and forced typecheck also passed.
- Running the updated mobile browser checks with native Chromium outside the sandbox, then completing entry/PvP checks and the production build. No complete final browser pass is claimed yet.

Next log update due by 11:00 WAT during active work.
## 2026-11-08 11:06 WAT — Final touch-release verification

- Native pointer tracing confirmed the browser automation must pass the newly pressed/lifted finger to Chromium, rather than restarting or ending the held joystick finger. Updated the mobile check to match real staggered multitouch.
- The game already received independent movement and Sprint correctly. Rechecking selective release, cancellation, pause, and Attack with the final six-button layout.
- Inspected the final landscape capture: Sprint top, Grab left, Attack right, Dodge below, and Special/Ultimate at the far-right edge. Ability rings are now thin and leave their icons legible.
- Automatic first-time/direct lobby loading, real loading milestones, portraits, welcome gift, and orientation/reduced-motion checks have passed individually. Completing the corrected entry/reveal/PvP browser scenarios and production build before final reporting.

Next log update due by 11:21 WAT during active work.

## 2026-11-08 11:25 WAT — Resume and Attack verification

- Continued with the final six-button mobile layout preserved: Sprint top, Grab left, Attack right, Dodge below, with Special and Ultimate at the far-right edge.
- The last mobile browser run passed joystick geometry, analog movement, staggered movement/Sprint, selective release, cancellation, pause/reset, and orientation fallbacks. Its remaining failure was the Attack assertion 300 ms after resuming.
- Attack intentionally waits 200 ms to distinguish a single press from a double press, then commits on a combat frame. Updated the browser check to wait for enabled input and a sampled attack, retaining pointer/injection diagnostics before deciding whether the application needs a correction.
- Completing the full corrected entry/reveal/PvP browser run, then final forced typecheck and production build. Earlier individual passes do not yet constitute a complete final browser pass.

Next log update due by 11:40 WAT during active work.

## 2026-11-08 11:47 WAT — Full browser run and shuffle inspection

- Fresh combined browser verification passed first-time automatic entry, the once-only 1,500-Ember gift, saved fighter/name, advancing percentage loading, all five playable portraits, shared live home renderer, guide/FAQ content, and direct lobby navigation.
- The corrected Attack check passed. The complete mobile scenario also passed analog movement, staggered multitouch, selective release, cancellation, pause/reset, the final six-button layout, landscape request/release, and unsupported/reduced-motion fallback.
- The first-time scenario recorded only four unrevealed shuffle frames and failed its motion assertion. Inspecting arena rendering while entry is blocked and entrance animations before making a correction. PvP verification is still running; a complete suite and production build have not yet passed.

Next log update due by 12:02 WAT during active work.

## 2026-11-08 12:03 WAT — Visible reveal and complete first-time flow

- Replaced the premature wall-clock reveal timer with completion of the actual CSS reel animation. The fresh browser run now confirms multiple visible shuffle frames, the exact arena opponent on the final card, arena readiness before transition, and frozen combat throughout the reveal/tutorial.
- Kept home text visible from its first frame while retaining the subtle entrance movement. The live home capture now shows the Veilstrike title and Play Game action immediately.
- The complete first-time scenario passed setup, lobby entry, welcome gift, portraits, guide/FAQs, saved tours, reveal, tutorial completion, post-intro movement, pause, reload persistence, and the two audio sliders. Mobile and unsupported/reduced-motion checks also passed again.
- Visual inspection found the matchup overlay below the combat HUD, allowing the opponent name to appear during the shuffle. Correcting this layering after the current PvP capture finishes. The final complete suite and production build remain pending.

Next log update due by 12:18 WAT during active work.

## 2026-11-08 12:19 WAT — Matchup layering and PvP handoff tracing

- Raised the matchup screen above the combat HUD and made its background opaque, preventing overlapping header text and an early opponent-name leak during the shuffle. Added a browser hit-test for the covered health headings.
- The last combined run passed 45 checks, including the complete first-time/Quick Match flow and all mobile scenarios. Its sole remaining failed scenario was PvP loading: both clients reached 100% but stayed waiting with no received match snapshot.
- Added WebSocket message diagnostics and started a focused two-client PvP run to distinguish the loaded-message handoff from an application transition problem. Preserved existing connection, combat, and audio logic pending that evidence.
- Final forced typecheck, production build, and a fully passing combined browser report are still pending.

Next log update due by 12:34 WAT during active work.

## 2026-11-08 12:42 WAT — Fresh server and final TypeScript verification

- WebSocket tracing confirmed both browsers sent loaded and the old server marked their room fighting, but neither received a state message. Verified that the local server process was still running from 7 November with previously imported build modules.
- Final forced TypeScript checking passed. After sandbox approval to stop the verified local server, started it again with the current compiled simulation. Its health endpoint is responding. Restarted the web preview closed by the old development wrapper.
- Rechecking real PvP against these fresh processes, then the complete browser suite with the opaque matchup overlay and the final production build. No gameplay/network logic was changed merely to bypass the failed verification.

Next log update due by 12:57 WAT during active work.

## 2026-11-08 — New-change commit and Vercel build correction

- User authorized committing the newer changes and pushing them to GitHub, and supplied Vercel's `tsc: command not found` build error.
- Added Vercel configurations for both repository-root and `apps/web` projects. Both run `npm ci --include=dev` so TypeScript and Vite are installed during production builds, and publish the current web workspace output. Added deployment instructions, including the existing separate WebSocket server requirement for online PvP.
- Fresh production build and forced typecheck passed. All 24 gameplay/WebSocket tests and all nine combat-audio tests passed. The offline clean-install dry run with development dependencies also passed.
- Roadmap browser verification passed direct routing, artwork, keyboard phase navigation, autoplay/pause, mobile/landscape layout, and reduced motion. Corrected its fake-clock setup to install before starting the presentation timer.
- Preserved the earlier browser reports, including their failed PvP/mobile attempts; this entry does not claim a fresh combined entry/PvP browser pass.
- GitHub reports a separate Vercel deployment rate limit for the `web` and `veilstrk` projects. The build configuration correction does not remove that external limit. Preparing the reviewed changes for commit and push.

## 2026-11-08 14:01 WAT — User confirmation and build handoff

- User confirmed the controls work. Preserved the final mobile diamond: Sprint top, Grab left, Attack right, Dodge bottom; Special and Ultimate at the far-right edge.
- Confirmed the cancelled operation did not alter the arena render loop or append its proposed log entry. No task-owned browser-check process remains running.
- Updated the entry documentation to describe animation-completion-based opponent reveal and the opaque matchup screen above the combat HUD.
- Prior verification passed all 21 gameplay/WebSocket tests, nine combat-audio tests, forced TypeScript checking, and 45 combined browser checks including the complete first-time and mobile flows. Browser PvP still timed out despite successful direct and Vite-proxied two-client WebSocket probes; no complete combined browser pass is claimed.
- Completing the production build sequentially. Final validation results will be recorded after it finishes.

Next log update due by 14:16 WAT during active work.

## 2026-11-08 14:03 WAT — Final production build

- `npm.cmd run build` passed: server TypeScript compilation, web TypeScript project compilation, and the Vite production bundle all completed successfully.
- The build reports the existing large-chunk warning for the asynchronously loaded GameLobby bundle (846.19 kB minified, 228.74 kB gzip). This is a warning, not a compilation failure.
- Confirmed the combined browser report contains 45 passing checks out of 46, with no application errors recorded. The remaining check is the two-browser PvP scenario; its timeout remains a validation limitation despite the successful direct and Vite-proxied WebSocket probes.
- Whitespace verification passed for the changed entry, matchup, mobile-control, browser-check, and documentation files. The entry guide now accurately describes the animation-completion-based reveal and final mobile controls.
- Finished the build handoff with the user's confirmed mobile layout preserved. No further browser investigation, commit, or deployment was performed.
