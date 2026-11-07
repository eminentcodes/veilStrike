import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { ArrowRight, CheckCircle, X } from '@phosphor-icons/react';
import { CHAMPIONS, STARTER_FIGHTER_IDS } from '@/duel/catalog';
import type { ChampionId, StarterFighterId } from '@/duel/catalog';
import { ONBOARDING_EMBERS, playerNameError } from '@/duel/progression';
import { FighterPortrait } from './FighterPortrait';

function EntryDialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className={'entry-dialog' + (wide ? ' entry-dialog-wide' : '')} aria-labelledby={id}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header><h2 id={id}>{title}</h2><button className="entry-icon" aria-label="Close dialog" onClick={onClose}><X size={22}/></button></header>
    {children}
  </dialog>;
}

const styles = {
  karen: { type: 'BALANCED', description: 'Quick swordplay and throwing blades. A great place to start.' },
  taren: { type: 'DEFENSIVE', description: 'Hold your ground with a tower shield, spear, and powerful counters.' },
  nomet: { type: 'BRAWLER', description: 'Get close. Break defenses with crushing punches and ground slams.' },
};

export function FirstTimeSetup({ initialName, selectedFighter, onSelect, onComplete, onClose }: {
  initialName: string; selectedFighter: ChampionId; onSelect: (id: StarterFighterId) => void;
  onComplete: (name: string, fighter: StarterFighterId) => void; onClose: () => void;
}) {
  const [name, setName] = useState(initialName), [error, setError] = useState('');
  const selected = STARTER_FIGHTER_IDS.find(id => id === selectedFighter) ?? 'karen';
  const input = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const invalid = playerNameError(name);
    setError(invalid);
    if (invalid) { input.current?.focus(); return; }
    onComplete(name, selected);
  };
  return <EntryDialog title="Your story starts here." wide onClose={onClose}>
    <form className="first-time-setup" onSubmit={submit}>
      <p className="entry-intro">Choose your name and a free fighter. Complete setup to receive {ONBOARDING_EMBERS.toLocaleString()} Embers as a welcome gift.</p>
      <div className="entry-name-field"><label htmlFor="new-player-name">Your player name</label>
        <input ref={input} id="new-player-name" autoFocus autoComplete="nickname" minLength={2} maxLength={18} value={name}
          placeholder="What should we call you?" aria-invalid={!!error} aria-describedby={error ? 'name-error' : 'name-hint'}
          onChange={event => { setName(event.target.value); if (error) setError(''); }}/>
        <small id="name-hint">2 to 18 characters. You can change it in your profile.</small>
        {error && <p className="entry-field-error" id="name-error" role="alert">{error}</p>}
      </div>
      <fieldset className="starter-fieldset"><legend>Choose your first fighter</legend>
        <div className="starter-cards">{STARTER_FIGHTER_IDS.map(id => <label key={id} className={'starter-card' + (selected === id ? ' is-selected' : '')} style={{ '--fighter-accent': CHAMPIONS[id].accent } as CSSProperties}>
          <input className="entry-radio" type="radio" name="starter-fighter" value={id} checked={selected === id} onChange={() => onSelect(id)}/>
          <div className="starter-art"><FighterPortrait id={id}/><span className="starter-free">FREE</span>{selected === id && <CheckCircle className="starter-check" size={25} weight="fill"/>}</div>
          <div className="starter-copy"><small>{styles[id].type}</small><strong>{CHAMPIONS[id].name}</strong><p>{styles[id].description}</p></div>
        </label>)}</div>
      </fieldset>
      <footer className="setup-footer"><p>All three are yours. Switch fighters anytime in the lobby.</p><button type="submit" className="entry-primary">ENTER LOBBY<ArrowRight size={21}/></button></footer>
    </form>
  </EntryDialog>;
}

export const FAQS = [
  ['Is Veilstrike free to play?', 'Yes. Karen, Taren, and Nomet are free from the start. Play Quick Matches or invite a friend to a private PvP room.'],
  ['How do I earn Embers?', 'New players receive a one-time 1,500-Ember welcome gift after setup. A completed win earns 75 Embers, a draw earns 30, and a loss earns 25 if you won a round. The daily spin awards 25 to 500 Embers.'],
  ['Can I play against a friend?', 'Choose Online PvP in the lobby. Create a room and share its code, or join with a code from your friend. Both players choose Ready before the match starts.'],
  ['Where is my progress saved?', 'Your name, fighter choice, upgrades, Embers, and tutorial progress are saved in this browser on this device. Clearing browser storage removes this local progress.'],
  ['How do I learn the controls?', 'Your first Quick Match includes an in-game controls tour. You can also open Controls from the lobby or the match menu, or read the complete game guide.'],
  ['Are more fighters and modes available?', 'Five fighters are available now: Karen, Taren, Nomet, Veyra, and Mawren. More fighters are coming soon. The collection shows each fighter’s current availability. Story mode is in development.'],
] as const;

export function FaqDialog({ onClose }: { onClose: () => void }) {
  return <EntryDialog title="Frequently asked questions" onClose={onClose}>
    <div className="faq-content">{FAQS.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      <a className="entry-text-link" href="#guide">Read the full game guide<ArrowRight size={18}/></a>
    </div>
  </EntryDialog>;
}
