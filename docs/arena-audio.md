# Arena audio

Storm by Aylex plays quietly and loops in the lobby. The Sound slider controls music; Effects controls interface sounds, combat, ambience and the announcer. These are the only lobby audio adjustments.

The arena announcer uses Microsoft's male Guy Neural voice, matching the Edge Neural speech engine documented by Bountiq's `Desktop/Gentank` README. That checkout does not contain Bountiq's female voice profile. The male voice has a lowered pitch, EQ, compression, stereo reflections and restrained arena reverb. Rendered files play locally; runtime speech synthesis is not used.

Fast round calls say "Round one, Fight!", "Round two, Fight!", and "Round three, Fight!" when needed. Fight starts at 1.025 seconds. Round events occur during the held intro. AI combat releases from the audio playback position, and PvP inputs remain held until the same spoken marker. Muted audio permits the fast intro to complete. Victory and Defeat replace the final result stings. Occasional signature, ultimate, parry, guard-break and heavy-impact calls are spaced apart; urgent results interrupt reactions.

The original arena music, Into the Veil, lasts 25 seconds from actual arena entry. A 120 BPM syncopated kick/snare beat, pulsing bass, stereo hats and tom fills support bright harmonic-minor arpeggios and high string tension. Bowed harmonics and short stereo delays give it depth. Its final three seconds fade out; it does not loop or restart after pausing an expired track. Voices duck the music; ambience remains after the opening music ends.

Rebuild from the root with `python scripts/build-announcer-audio.py` and `python scripts/build-arena-music.py`. Requirements are in `audio/requirements-build.txt`; the music generator also uses FFmpeg. The generators use the cached build tools in `.cache/audio-tools`. The legacy generator preserves these selected tracks and mastered voice files.

Voice transcripts and mastering details: `apps/web/public/audio/voice/cues.json` and `profile.json`. Music details: `apps/web/public/audio/arena-music.json`. Combat source/license details remain in the audio README.
