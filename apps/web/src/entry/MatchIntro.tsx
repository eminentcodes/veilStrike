import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, Sword } from '@phosphor-icons/react';
import { ARENAS, CHAMPIONS, PLAYABLE_FIGHTER_IDS } from '@/duel/catalog';
import type { ChampionId, DuelConfig } from '@/duel/catalog';
import { fightAudio } from '@/fight/audio';
import { FighterPortrait } from './FighterPortrait';
import './match-intro.css';

const SPIN_DURATION = 1900;

export function MatchIntro({ config, playerName, ready, onComplete, onExit }: {
  config: DuelConfig; playerName: string; ready: boolean; onComplete: () => void; onExit: () => void;
}) {
  const reducedMotion = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [revealed, setRevealed] = useState(reducedMotion), [spinning, setSpinning] = useState(false);
  const complete = useRef(onComplete); complete.current = onComplete;
  const reel = useMemo(() => {
    const candidates = PLAYABLE_FIGHTER_IDS.filter(id => id !== config.player);
    return [...Array.from({ length: 20 }, (_, index) => candidates[index % candidates.length]!), config.opponent];
  }, [config.player, config.opponent]);

  useEffect(() => {
    if (reducedMotion) return;
    let active = true, stopSpin = () => {}, timer = 0, secondFrame = 0;
    // Start the timed shuffle after its first paint, so arena preparation cannot consume the reveal.
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (!active) return;
        setSpinning(true);
        void fightAudio.ready.then(() => { if (active && !document.hidden) stopSpin = fightAudio.sound('spin-wheel-0', .48); });
        timer = window.setTimeout(() => { stopSpin(); setRevealed(true); }, SPIN_DURATION);
      });
    });
    const visibility = () => { if (document.hidden) stopSpin(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { active = false; cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); window.clearTimeout(timer); stopSpin(); document.removeEventListener('visibilitychange', visibility); };
  }, [reducedMotion]);

  useEffect(() => {
    if (revealed) return fightAudio.sound('ui-reward', .62);
  }, [revealed]);

  useEffect(() => {
    if (!revealed || !ready) return;
    const timer = window.setTimeout(() => complete.current(), reducedMotion ? 250 : 900);
    return () => window.clearTimeout(timer);
  }, [revealed, ready, reducedMotion]);

  return <section className="match-intro" aria-label="Quick Match matchup" data-arena-ready={ready} data-revealed={revealed} data-opponent={revealed ? config.opponent : ''}>
    <header><button onClick={onExit} className="match-intro-back"><ArrowLeft size={18}/>LOBBY</button><div><Sword size={19}/><span>QUICK MATCH</span></div><small>{ARENAS[config.arena].name}</small></header>
    <div className="matchup-stage">
      <MatchCard id={config.player} name={playerName} label="YOUR FIGHTER"/>
      <div className="matchup-versus" aria-label="versus"><span>VS</span></div>
      <div className={'rival-reveal' + (revealed ? ' is-revealed' : ' is-spinning')}>
        {revealed ? <div className="rival-card-frame"><MatchCard id={config.opponent} name="YOUR OPPONENT" label="RIVAL REVEALED"/></div> :
          <div className="match-fighter-card rival-draw-card">
            <div className="match-card-player"><small>RANDOM OPPONENT</small><strong>Finding your rival</strong></div>
            <div className="match-card-art rival-spinner">
              <div className={'rival-reel' + (spinning ? ' is-running' : '')} aria-hidden="true" style={{ '--reel-distance': '-' + (reel.length - 1) * 100 + '%', '--spin-duration': SPIN_DURATION + 'ms' } as CSSProperties}>
                {reel.map((id, index) => <FighterPortrait key={index} id={id} className="rival-reel-image"/>)}
              </div>
              <div className="rival-spinner-shade" aria-hidden="true"/>
              <div className="rival-spinner-ring" aria-hidden="true"/>
              <img className="rival-seal" src={import.meta.env.BASE_URL + 'veilstrike-mark.svg'} alt="" width="62" height="62" aria-hidden="true"/>
            </div>
            <div className="match-card-style"><span>Random draw</span><small>FIVE FIGHTERS. ONE RIVAL.</small></div>
          </div>}
      </div>
    </div>
    <footer><span className="match-intro-line" aria-hidden="true"/><p aria-live="polite">{revealed ? ready ? 'Fighters ready. The arena awaits.' : 'Loading the arena…' : 'A challenger awaits.'}</p><span className="match-intro-line" aria-hidden="true"/></footer>
  </section>;
}

function MatchCard({ id, name, label }: { id: ChampionId; name: string; label: string }) {
  const fighter = CHAMPIONS[id];
  return <div className="match-fighter-card" data-fighter={id}>
    <div className="match-card-player"><small>{label}</small><strong>{name}</strong></div>
    <div className="match-card-art"><FighterPortrait id={id}/><div className="match-card-scrim" aria-hidden="true"/>
      <div className="match-card-name"><small>{fighter.title}</small><h2>{fighter.name}</h2></div>
    </div>
    <div className="match-card-style"><span>{fighter.species}</span><small>{fighter.specialName}</small></div>
  </div>;
}
