import { useEffect } from 'react';
import { ArrowRight, BookOpen, Question, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { useGameAudio } from '@/audio/AudioProvider';
import { fightAudio } from '@/fight/audio';

export function HomePage({ worldReady, onPlay, onPrepare }: { worldReady: boolean; onPlay: () => void; onPrepare: () => void }) {
  const { muted, toggleMuted } = useGameAudio();
  useEffect(() => {
    fightAudio.suspend(document.hidden);
    fightAudio.setArena('sanctum');
    fightAudio.startMusic('menu');
    const visibility = () => fightAudio.suspend(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); fightAudio.stopMusic(); };
  }, []);

  return <main className={'game-home' + (worldReady ? ' has-world' : '')}>
    <img className="home-world" src={import.meta.env.BASE_URL + 'images/entry-sanctum.webp'} alt="" fetchPriority="high" decoding="async"/>
    <div className="home-scrim" aria-hidden="true"/>
    <header className="home-nav">
      <img src={import.meta.env.BASE_URL + 'veilstrike-mark.svg'} width="42" height="42" alt="Veilstrike"/>
      <nav aria-label="Game information">
        <a href="#guide"><BookOpen size={18}/>Game guide</a>
        <a href="#roadmap"><ArrowRight size={18}/>Roadmap</a>
        <a href="#faq"><Question size={18}/>FAQs</a>
        <button className="home-sound" aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted} onClick={toggleMuted}>
          {muted ? <SpeakerSlash size={20}/> : <SpeakerHigh size={20}/>}
        </button>
      </nav>
    </header>
    <div className="home-title">
      <p>THE OATHBOUND ARENA</p>
      <h1>VEILSTRIKE</h1>
      <span className="home-description">Choose your fighter. Read the opening. Leave your mark.</span>
      <button className="entry-primary home-play" onClick={onPlay} onPointerEnter={onPrepare} onFocus={onPrepare}>
        <span>PLAY GAME</span><ArrowRight size={24}/>
      </button>
    </div>
    <footer className="home-credit">Eminent™</footer>
  </main>;
}
