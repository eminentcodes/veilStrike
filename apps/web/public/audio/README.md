# Veilstrike audio

The runtime reads `manifest.json`; assets are bundled for local playback.

- Lobby: **Storm** by **Aylex**, from **freetouse.com**, supplied by the user as an MP3. `music-lobby-storm.mp3` is the unchanged recording. It loops at a low background gain and uses the Sound slider, mute, fades, and background-tab suspension.
- Arena: original **Into the Veil**, a 25-second, 120 BPM beat with pulsing bass, bright high-register tension notes and a three-second fade out. Plays once per match; arena ambience continues afterward. Announcer calls duck the music.
- Announcer: 24 locally rendered deep male Edge Neural cues, with EQ, compression, stereo reflections and restrained arena echo. Round calls reach Fight at 1.025 seconds; fighters stay held until that playback marker. Final results say Victory or Defeat, with occasional signature and impact reactions.
- Interface: original stereo hover/click sounds, eight mechanical spin recordings synchronized to the wheel, and separate reward/jackpot chimes. The user approved the hover; the click was revised into a short mechanical snap.
- Combat: Kenney's free **RPG Audio** recordings (CC0), layered with original impact and musical elements, then processed with **Spotify Pedalboard** for EQ, compression, room reverb, and limiting. Covers punches, blades, shields, movement, five surfaces, grapples, falls, dropped equipment, and round/match results.

**Audio settings** has two sliders: **Sound** controls music; **Effects** controls interface, combat, ambience and announcer audio.

Source details: `combat-sources.json`. The CC0 license is `licenses/kenney-rpg-CC0.txt`; original OGGs live in `assets/audio/sources/kenney-rpg` at the repository root. Downloaded from https://github.com/Boyquotes/kenney-rpg-audio-for-godot/tree/22eb79b; original pack: https://kenney.nl/assets/rpg-audio.

Rebuild from the repository root:

```powershell
python -m pip install --target .cache/audio-tools -r audio/requirements-build.txt
python scripts/build-ui-audio.py
python scripts/build-combat-audio.py
python scripts/build-announcer-audio.py
python scripts/build-arena-music.py
npm run test:audio
```

Pedalboard is a build tool; the browser plays the rendered WAVs through Howler. The legacy `build-audio.py` preserves the lobby track, manifest revision, and mastered combat/click files while generating missing baseline or voice assets. Re-run the two current builders after using older procedural polish/impact scripts.
