# Lobby redesign and audio

Reading this as a dark fantasy game lobby for arena players, with a central selected fighter and peripheral game controls, inspired by the lobby organization of Free Fire and CODM.

Design dials: variance 5, motion 6, density 5. Keep the existing Veilstrike wordmark, dark 3D arenas, amber accent, and readable button focus states. Use the existing React/Three.js stack and native CSS with Phosphor icons. This is a game interface, so marketing-page layout and light-theme prescriptions from the taste skill do not apply to the user-selected dark fantasy direction.

The previous page split a two-character preview between a text-heavy introduction, permanently expanded mode/arena/opponent controls, and a six-item roster despite the changed specification. The requested replacement has exactly one selected character in the center, an upper-left player card, side controls opening character and mode panels, and a lower-right Play button. Keyboard-accessible dialogs retain mode, arena, opponent, and difficulty choices. The fighter automatically performs its signature on a spaced interval; reduced-motion users can trigger it manually.

Lobby music should be quiet and distinct from battle music. Combat adds weapon-specific impacts and signatures, surface footsteps, arena ambience, and a voiced announcer. Music ducks during announcements. Voices are pre-rendered neural speech with browser speech as a graceful fallback, and have priorities/cooldowns to avoid constant chatter. Sound settings persist separately for master, music, effects, and voices. Pause, screen changes, mute, and tab hiding must cleanly stop or suspend sound.
