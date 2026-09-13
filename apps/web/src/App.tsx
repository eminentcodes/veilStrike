import { useState } from 'react';

import { fightAudio } from '@/fight/audio';
import { FightGame } from '@/fight/FightGame';
import { FIGHTER_DEFINITIONS, type Difficulty, type FighterId, type MatchResult } from '@/fight/types';

type Screen = 'menu' | 'select' | 'fight' | 'result';

const FIGHTERS = FIGHTER_DEFINITIONS;
const OPPONENTS: Record<FighterId, FighterId> = { kael: 'brakk', ronin: 'shade', monk: 'valen', brakk: 'kael', shade: 'ronin', valen: 'monk' };

export function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [fighter, setFighter] = useState<FighterId>('kael');
  const [difficulty, setDifficulty] = useState<Difficulty>('warrior');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [muted, setMuted] = useState(() => fightAudio.isMuted());
  const opponent = OPPONENTS[fighter];

  if (screen === 'fight') {
    return (
      <FightGame
        player={fighter}
        opponent={opponent}
        difficulty={difficulty}
        onExit={() => setScreen('menu')}
        onComplete={(next) => {
          setResult(next);
          setScreen('result');
        }}
      />
    );
  }

  if (screen === 'result' && result) {
    return (
      <main className="result-screen">
        <SoundToggle muted={muted} onToggle={() => setMuted(fightAudio.toggle())} />
        <div className="result-backdrop" />
        <section className="result-panel">
          <p className="eyebrow">MATCH COMPLETE</p>
          <h1>{result.tied ? 'DRAW' : result.won ? 'VICTORY' : 'DEFEAT'}</h1>
          <p>{result.playerRounds} - {result.botRounds}</p>
          <div className="menu-actions">
            <button className="primary-action" onClick={() => setScreen('fight')}>REMATCH</button>
            <button className="secondary-action" onClick={() => setScreen('select')}>CHANGE FIGHTER</button>
            <button className="text-action" onClick={() => setScreen('menu')}>MAIN MENU</button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === 'select') {
    return (
      <main className="select-screen">
        <SoundToggle muted={muted} onToggle={() => setMuted(fightAudio.toggle())} />
        <header className="select-header">
          <button className="back-button" onClick={() => setScreen('menu')} aria-label="Back">&#8592;</button>
          <div>
            <p className="eyebrow">CHOOSE YOUR FIGHTER</p>
            <h1>ENTER THE VEIL</h1>
          </div>
        </header>

        <section className="fighter-grid">
          {(Object.keys(FIGHTERS) as FighterId[]).map((id) => {
            const entry = FIGHTERS[id];
            return (
              <button
                key={id}
                className={`fighter-choice fighter-choice--${id} ${fighter === id ? 'is-selected' : ''}`}
                onClick={() => setFighter(id)}
              >
                <span className={`fighter-portrait fighter-portrait--${id}`} aria-hidden />
                <span className="fighter-copy">
                  <strong>{entry.name}</strong>
                  <small>{entry.title}</small>
                  <span>{entry.weapon}</span>
                  <em>{entry.archetype} · {entry.description}</em>
                  <div className="fighter-stats"><span>VIT {entry.health}</span><span>SPD {entry.speed}</span><span>PWR {Math.round(entry.power * 100)}</span><span>RNG {entry.reach}</span></div>
                  <i>Strong: {entry.strengths.join(' · ')}</i>
                  <i>Weak: {entry.weakness}</i>
                </span>
              </button>
            );
          })}
        </section>

        <section className="fight-config">
          <div>
            <span className="config-label">DIFFICULTY</span>
            <div className="difficulty-control">
              {(['initiate', 'warrior', 'master'] as Difficulty[]).map((level) => (
                <button
                  key={level}
                  className={difficulty === level ? 'is-active' : ''}
                  onClick={() => setDifficulty(level)}
                >{level === 'initiate' ? 'EASY' : level === 'warrior' ? 'NORMAL' : 'HARD'}</button>
              ))}
            </div>
          </div>
          <button className="primary-action fight-button" onClick={() => setScreen('fight')}>BEGIN FIGHT</button>
        </section>
      </main>
    );
  }

  return (
    <main className="title-screen">
      <SoundToggle muted={muted} onToggle={() => setMuted(fightAudio.toggle())} />
      <div className="sun-disc" aria-hidden />
      <div className="mountain mountain-one" aria-hidden />
      <div className="mountain mountain-two" aria-hidden />
      <div className="temple" aria-hidden />
      <div className="duelists" aria-hidden><span className="duelist left" /><span className="duelist right" /></div>
      <section className="title-content">
        <p className="eyebrow">A SINGLE-PLAYER FIGHTING GAME</p>
        <h1>VEIL<span>STRIKE</span></h1>
        <p className="title-copy">Master the blade. Read your opponent. Survive the veil.</p>
        <button className="primary-action" onClick={() => { fightAudio.startMusic('menu'); setScreen('select'); }}>PLAY GAME</button>
        <div className="landing-preview">
          <div><strong>6 FIGHTERS</strong><span>Choose your warrior.</span></div>
          <div><strong>FIGHT AN ENEMY</strong><span>Move, block, dodge and attack.</span></div>
          <div><strong>3 ROUNDS</strong><span>Use special powers to win.</span></div>
        </div>
      </section>
      <p className="build-note">A FAST WARRIOR FIGHTING GAME</p>
    </main>
  );
}

function SoundToggle({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return <button className="sound-toggle" onClick={onToggle} aria-label={muted ? 'Enable sound' : 'Mute sound'}>{muted ? 'SOUND OFF' : 'SOUND ON'}</button>;
}
