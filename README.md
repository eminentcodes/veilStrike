# Veilstrike

Veilstrike is a 3D dark fantasy arena fighter built with React, TypeScript and
Three.js. Play against adaptive AI or a friend in a private online PvP room.

## Gameplay

- Five playable fighters: Karen, Taren, Nomet, Veyra and Mawren, with distinct weapons, signatures and ultimates.
- Five arenas and best-of-three matches with 180-second rounds.
- Directional movement, jumping, sprinting, dodging, guards, parries, grabs and throws.
- Light and heavy attacks share one Attack control; impacts stagger fighters, while sustained pressure and powerful moves cause knockdowns and grounded recovery.
- A character lobby, first-time setup and guided tours, an animated AI opponent reveal, a full game guide, character upgrades and daily Ember rewards.
- Quiet Storm lobby music, rich interface/combat effects, a deep male neural announcer and a 25-second arena opening beat. Fighters stay held until the announcer says Fight. Audio settings contains Sound and Effects.

## Controls

| Action | Keyboard / mouse |
| --- | --- |
| Move | W / A / S / D |
| Sprint | Hold Shift |
| Jump | C |
| Light attack | J / Left click |
| Heavy attack | Double-press J / Left click |
| Guard / parry | Hold / tap L or Right click |
| Dodge | Space |
| Grab and throw | E |
| Signature / ultimate | U / I |
| Toggle target lock | Tab |
| Match menu | Escape |

Touch controls are available on supported devices. Quick Matches pause when the
menu opens; online PvP continues while its menu is open.

## Development

Requires Node.js 20.11 or newer.

```bash
npm ci
npm run dev
```

The web app normally runs at `http://localhost:5173`. The development command also
starts the PvP server on port 8787; Vite proxies `/duel` and `/health` to it.

## Build and checks

```bash
npm run typecheck
npm run test:duel
npm run test:audio
npm run build
npm run preview
```

The production web app is written to `apps/web/dist`. For online PvP in production,
run `npm run start:server` after building and proxy `/duel` WebSocket connections
and `/health` HTTP requests to the server. Set `PORT` to change its default port.

## Assets and audio

The current playable fighters use rigged Blender/glTF assets with CC0 MakeHuman
anatomical foundations and original Veilstrike costumes and equipment. Preserve
the bundled licenses, including those for retained KayKit assets.

Combat audio uses CC0 Kenney recordings processed with Spotify Pedalboard and
original layers. Storm by Aylex, from freetouse.com, is the supplied lobby track.
The arena beat is an original composition; the announcer uses locally rendered
Edge Neural recordings. Source details, attribution and audio rebuild instructions
are in [the audio README](apps/web/public/audio/README.md) and
[arena audio documentation](docs/arena-audio.md).

Eminent™
