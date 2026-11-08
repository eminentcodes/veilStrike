# Veilstrike: AI-assisted development note

**Development model: GPT-6.1 Sol, used through Codex.** The project developer supplied
the game direction, reference materials, resources, and repeated gameplay and
visual feedback. The agent helped turn those instructions into code, assets, and
iterations of the playable build.

## Tools and resources

The development workflow gave the agent repository access, terminal commands,
file editing, Node.js test tools, and Playwright browser reviews. The game uses
React, TypeScript, Vite, Three.js, a Node.js/WebSocket PvP server, and Howler audio.
Blender and glTF support character assets; Python and Pillow support asset
processing; Spotify Pedalboard processes audio during the build workflow.


| Resource | Role in this phase |
| --- | --- |
| [Three.js](https://github.com/mrdoob/three.js) | Used for 3D rendering, animated fighters, arenas, and visible combat effects. |
| Blender MCP | Shared through  as a Blender integration resource |
| [Motion](https://github.com/motiondivision/motion) |
| postprocessing | Shared as a rendering-effects resource. The game currently uses Three.js's own EffectComposer and bloom passes. |
| Three.quarks | Shared as a particle-effects resource. Current combat particles, trails, ground cracks, and shockwaves are implemented in the Three.js renderer. |
| [anime.js](https://github.com/juliangarnier/anime) | Supplied as an animation reference; not integrated into the current build. |
| [cannon-es](https://github.com/pmndrs/cannon-es)  |
| [Effekseer](https://github.com/effekseer/Effekseer) |

Materials included the CC0 MakeHuman anatomical foundations, retained licensed character assets, and
original Veilstrike costumes and equipment. Audio combines the supplied **Storm**
track by Aylex, CC0 Kenney recordings, original sound layers and arena music, and
locally rendered Edge Neural announcer recordings. Asset credits and licenses
remain in the repository.

Audio resources and files include:

-  `Aylex - Storm (freetouse.com).mp3`, bundled as
  [`music-lobby-storm.mp3`](../apps/web/public/audio/music-lobby-storm.mp3).
- [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio), obtained from the
  [Boyquotes GitHub mirror](https://github.com/Boyquotes/kenney-rpg-audio-for-godot/tree/22eb79b)
  with its CC0 license.
- [Spotify Pedalboard](https://github.com/spotify/pedalboard), used for audio
  processing, and [edge-tts](https://github.com/rany2/edge-tts), used for
  announcer asset generation.
- Original interface/spin cues, mastered combat effects, and the original
  25-second **Into the Veil** arena beat. See the
  [audio credits and rebuild instructions](../apps/web/public/audio/README.md),
  [combat source manifest](../apps/web/public/audio/combat-sources.json), and
  [arena audio notes](arena-audio.md).

## What the agent helped build

- Combat controls: fighter stances, standing impact staggers, sustained-impact
  knockdowns, recovery, defeat surrender, equipment drops, and visible hit effects.
- Characters: fighters, character-specific signatures and ultimates with animated weapon and spell effects.
- Five distinct arenas,  modes and match rules.
- Ember rewards, character unlocks and upgrades, daily spin, and locked-fighter
  messaging.
- Lobby, onboarding, tutorials, game guide, touch controls, loading and
  opponent-reveal flows, and interface/combat audio.
- Asset-generation scripts, editable character scenes.



## Development record

[`agent.md`](../agent.md) records the creator's instructions, implementation decisions, and validation history.
