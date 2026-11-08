import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarStar, Check, Coins,
  DeviceMobile, Mountains, Pause, Play, Ranking, ShieldCheck, Sparkle,
  SpeakerHigh, SpeakerSlash, Sword, Trophy, UsersThree,
} from '@phosphor-icons/react';
import { useGameAudio } from '@/audio/AudioProvider';
import { fightAudio } from '@/fight/audio';
import './roadmap.css';

const PRESENTATION_SECONDS = 18;
const image = (file: string) => import.meta.env.BASE_URL + 'images/' + file;
const fighters = ['Karen', 'Taren', 'Nomet', 'Veyra', 'Mawren'];
const phases = [
  {
    id: 'now', label: 'Current build', subtitle: 'Playable now', status: 'Playable now',
    title: 'Built for battle.',
    description: 'Five fighters. Five distinct arenas. Quick Match against adaptive AI or a private PvP duel with a friend.',
    artwork: 'entry-sanctum.webp', artLabel: 'The current fighter roster',
    features: [
      { Icon: Sword, title: 'Combat with consequence', description: 'Standing staggers, powerful knockdowns, recovery, and visible signature abilities.' },
      { Icon: ShieldCheck, title: 'Your fighter. Your style.', description: 'Three starters and two Premium fighters with their own weapons, signatures, and ultimates.' },
      { Icon: Sparkle, title: 'Earn your next fighter', description: 'Win Embers, spin daily, unlock characters, and upgrade your roster.' },
    ],
    note: 'Guided setup, touch controls, character previews, arena music, combat sounds, and an announcer complete the current foundation.',
  },
  {
    id: 'next', label: 'Next phase', subtitle: 'Content & progression', status: 'Planned next',
    title: 'Beyond the arena.',
    description: 'A story to follow. New places to fight. More ways to build your place in Veilstrike.',
    artwork: 'previews/story.webp', artLabel: 'Atmosphere from Frostfall Citadel',
    features: [
      { Icon: BookOpen, title: 'Story Mode', description: 'Narrative chapters, character stories, objectives, and combat encounters.' },
      { Icon: Mountains, title: 'More arenas', description: 'New layouts, scenery, and distinct atmospheres.' },
      { Icon: UsersThree, title: 'More fighters', description: 'New identities, weapons, and animated abilities.' },
      { Icon: Ranking, title: 'Leaderboard rankings', description: 'A clear scoring system and a place to compete.' },
      { Icon: Trophy, title: 'Achievements', description: 'Visible milestones that recognize how you play.' },
    ],
    note: '',
  },
  {
    id: 'beyond', label: 'Beyond', subtitle: 'Under consideration', status: 'Under consideration',
    title: 'More ways to play.',
    description: 'After the next gameplay phase, we will explore a wider game economy, a mobile release, and more events.',
    artwork: 'previews/leaderboards.webp', artLabel: 'Atmosphere from the Hollow Rift',
    features: [
      { Icon: Coins, title: 'A possible game token', description: 'Explore a token for purchasing Embers and other in-game items. Its role is still to be defined.' },
      { Icon: DeviceMobile, title: 'A mobile app launch', description: 'Build on touch controls with dedicated mobile performance, interface, and distribution work.' },
      { Icon: CalendarStar, title: 'More events', description: 'Recurring challenges, themed events, and competitive gatherings.' },
    ],
    note: 'These directions remain exploratory. Scope will follow player feedback and feasibility; release dates have not been announced.',
  },
] as const;

export default function RoadmapPage({ onPlay }: { onPlay: () => void }) {
  const reduced = !!useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hidden, setHidden] = useState(document.hidden);
  const heading = useRef<HTMLHeadingElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const { muted, toggleMuted } = useGameAudio();
  const phase = phases[index]!;
  const auto = playing && !reduced && !hidden;
  const ease = [.22, 1, .36, 1] as const;

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);
  useEffect(() => {
    fightAudio.suspend(document.hidden);
    fightAudio.startMusic('menu');
    const visibility = () => { setHidden(document.hidden); fightAudio.suspend(document.hidden); };
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); fightAudio.stopMusic(); };
  }, []);
  useEffect(() => {
    if (!auto) return;
    const timer = window.setTimeout(() => setIndex(i => (i + 1) % phases.length), PRESENTATION_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [index, auto]);

  const choose = (next: number) => { setPlaying(false); setIndex(next); };
  const navigate = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % phases.length;
    else if (event.key === 'ArrowLeft') next = (index + phases.length - 1) % phases.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = phases.length - 1;
    else return;
    event.preventDefault(); choose(next); tabs.current[next]?.focus();
  };

  return <main className="roadmap-page">
    <header className="roadmap-header">
      <a className="roadmap-brand" href="#home" aria-label="Veilstrike home">
        <img src={import.meta.env.BASE_URL + 'veilstrike-mark.svg'} alt="" width="34" height="34"/>
        <span>VEILSTRIKE</span>
      </a>
      <nav aria-label="Roadmap navigation">
        <a href="#guide">Game guide</a>
        <a href="#home">Back to game <ArrowUpRight size={17}/></a>
        <button className="roadmap-sound" onClick={toggleMuted} aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted}>
          {muted ? <SpeakerSlash size={18}/> : <SpeakerHigh size={18}/>}
        </button>
      </nav>
    </header>

    <motion.div className="roadmap-intro" initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, ease }}>
      <p>DEVELOPMENT ROADMAP</p>
      <h1 ref={heading} tabIndex={-1}>The next chapter.</h1>
      <span>What you can play today. Where we go from here.</span>
    </motion.div>

    <motion.section className="roadmap-frame" aria-label="Veilstrike development phases" initial={reduced ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .75, delay: .12, ease }}>
      <div className="roadmap-scene" data-phase={phase.id}>
        <AnimatePresence initial={false}>
          <motion.div className="roadmap-backdrop" key={phase.id} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .75 }}>
            <motion.img src={image(phase.artwork)} alt="" initial={reduced ? false : { scale: 1.07 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease }}/>
          </motion.div>
        </AnimatePresence>

        <div id="roadmap-panel" role="tabpanel" aria-labelledby={`roadmap-tab-${index}`} aria-live={playing ? 'off' : 'polite'}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={phase.id} initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -10 }} transition={{ duration: reduced ? 0 : .4, ease }}>
              <div className="roadmap-phase-content">
                <div className="roadmap-phase-status">{index === 0 ? <Check weight="bold"/> : <Sparkle/>}{phase.status}</div>
                <h2>{phase.title}</h2>
                <p className="roadmap-phase-description">{phase.description}</p>
                <ul className={'roadmap-points' + (index === 1 ? ' is-next' : '')}>
                  {phase.features.map((feature, i) => <motion.li className="roadmap-point" key={feature.title}
                    initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4, delay: reduced ? 0 : .12 + i * .065, ease }}>
                    <feature.Icon size={22} weight="duotone"/>
                    <div><strong>{feature.title}</strong><p>{feature.description}</p></div>
                  </motion.li>)}
                </ul>
                {phase.note && <p className="roadmap-phase-note">{phase.note}</p>}
              </div>

              <div className="roadmap-art-label"><Mountains size={16}/>{phase.artLabel}</div>
              {index === 0 ? <div className="roadmap-lineup" aria-label="Five playable fighters">
                {fighters.map((name, i) => <motion.figure key={name} className="roadmap-fighter" initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: reduced ? 0 : .18 + i * .07, ease }}>
                  <div><img src={image(`fighters/${name.toLowerCase()}.webp`)} alt={`${name} in the current game`} loading="lazy" decoding="async"/></div>
                  <figcaption>{name.toUpperCase()}</figcaption>
                </motion.figure>)}
              </div> : <div className="roadmap-art-caption">
                <span>{index === 1 ? 'STORY MODE' : 'THE LONGER VIEW'}</span>
                <p>{index === 1 ? 'A journey through the fractured veil.' : 'A growing world. A returning community.'}</p>
              </div>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="roadmap-controls">
        <div className="roadmap-tabs" role="tablist" aria-label="Development phases">
          {phases.map((item, i) => <button key={item.id} ref={element => { tabs.current[i] = element; }} id={`roadmap-tab-${i}`}
            className={'roadmap-tab' + (i === index ? ' is-active' : '')} role="tab" aria-selected={i === index}
            aria-controls="roadmap-panel" tabIndex={i === index ? 0 : -1} onClick={() => choose(i)} onKeyDown={navigate}>
            {i === index && <motion.span className="roadmap-tab-marker" layoutId="roadmap-selected-phase" transition={{ duration: reduced ? 0 : .45, ease }}/>}<strong>{item.label}</strong><small>{item.subtitle}</small>
          </button>)}
        </div>
        <div className="roadmap-playback">
          <span>{reduced ? 'Manual view' : playing ? 'Auto presentation' : 'Presentation paused'}</span>
          {!reduced && <button aria-label={playing ? 'Pause presentation' : 'Play presentation'} aria-pressed={playing} onClick={() => setPlaying(p => !p)}>
            {playing ? <Pause size={17} weight="fill"/> : <Play size={17} weight="fill"/>}
          </button>}
          <button aria-label="Next development phase" onClick={() => choose((index + 1) % phases.length)}><ArrowRight size={20}/></button>
        </div>
        <div className="roadmap-auto-track" aria-hidden="true"><motion.span key={`${index}-${auto}`} initial={{ scaleX: 0 }} animate={{ scaleX: auto ? 1 : 0 }} transition={{ duration: auto ? PRESENTATION_SECONDS : 0, ease: 'linear' }}/></div>
      </div>
    </motion.section>

    <footer className="roadmap-footer">
      <div><p>The current build is playable. Upcoming features are shown as plans, with later directions still under consideration.</p><span className="roadmap-credit">Eminent™</span></div>
      <button className="entry-primary" onClick={onPlay}>PLAY VEILSTRIKE <ArrowRight size={18}/></button>
    </footer>
  </main>;
}
