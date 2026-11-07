import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CaretRight, Fire, MapTrifold, Shield, Sword, UsersThree } from '@phosphor-icons/react';
import { ARENAS, ARENA_IDS, CHAMPIONS, FIGHTER_IDS, STARTER_FIGHTER_IDS, playableFighter } from '@/duel/catalog';
import { ONBOARDING_EMBERS, UPGRADE_COST } from '@/duel/progression';
import { ROUND_LENGTH } from '@/duel/simulation';
import { FighterPortrait } from './FighterPortrait';
import { FAQS } from './EntryDialogs';
import './guide.css';

const topics = [
  ['start', 'Getting started'], ['characters', 'Characters'], ['controls', 'Controls'], ['combat', 'Combat & rounds'],
  ['arenas', 'Arenas'], ['modes', 'Game modes'], ['embers', 'Embers & upgrades'], ['settings', 'Profile & audio'], ['faq', 'FAQs'],
] as const;
const controls = [
  ['Move', 'W / A / S / D', 'Directional buttons', 'Move freely around the arena.'],
  ['Sprint', 'Hold Shift', 'Hold Sprint', 'Move faster while spending stamina.'],
  ['Jump', 'C', 'Jump', 'Leap and reposition.'],
  ['Light attack', 'J / Left click', 'Attack', 'Press once for a quick strike.'],
  ['Heavy attack', 'Double-press J / Left click', 'Double-tap Attack', 'Press twice quickly for a stronger, slower strike.'],
  ['Guard', 'Hold L / Right click', 'Hold Guard', 'Block attacks in front of your fighter.'],
  ['Parry', 'Tap L / Right click', 'Tap Guard', 'Time your guard just before an incoming strike.'],
  ['Dodge', 'Space', 'Dodge', 'Evade through an attack with a brief invulnerable window.'],
  ['Grab & throw', 'E', 'Grab', 'Grapple an opponent within close range.'],
  ['Signature', 'U', 'Signature ability button', 'Use your fighter’s special move when stamina and cooldown allow.'],
  ['Ultimate', 'I', 'Ultimate ability button', 'Use your strongest move when soul charge is full.'],
  ['Target lock', 'Tab', 'Lock On / Free Camera', 'Toggle automatic tracking of the opponent.'],
  ['Match menu', 'Escape', 'Menu', 'Pause a Quick Match or open the menu during online PvP.'],
] as const;

export default function GameGuide({ section }: { section?: string }) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById('guide-' + (section ?? 'start'));
      target?.scrollIntoView({ behavior: 'instant', block: 'start' });
      target?.querySelector<HTMLElement>('h1,h2')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [section]);

  return <main className="game-guide">
    <header className="guide-topbar"><a className="guide-wordmark" href="#home">VEILSTRIKE</a><div><a className="guide-home-link" href="#home"><ArrowLeft size={17}/>Home</a><a className="entry-primary" href="#lobby">PLAY GAME<ArrowRight size={18}/></a></div></header>
    <div className="guide-layout">
      <aside className="guide-sidebar"><div><BookOpen size={19}/><strong>THE HANDBOOK</strong></div><nav aria-label="Guide topics">{topics.map(([id, label]) => <a key={id} href={'#guide/' + id} className={(section ?? 'start') === id ? 'is-current' : ''}>{label}<CaretRight size={13}/></a>)}</nav></aside>
      <article className="guide-content">
        <section id="guide-start" className="guide-introduction"><h1 tabIndex={-1}>The arena handbook.</h1><p>Everything you need to choose a fighter, read the battle, and make your first move.</p>
          <div className="guide-quick-start"><h2>Start your first duel</h2><ol>
            <li><strong>Make it yours.</strong><span>Choose Play Game from the home screen. Enter your name and pick Karen, Taren, or Nomet. All three are free. Complete setup to receive {ONBOARDING_EMBERS.toLocaleString()} Embers.</span></li>
            <li><strong>Meet the lobby.</strong><span>The first-time tour introduces characters, arenas, daily Embers, game modes, and Play.</span></li>
            <li><strong>Choose Quick Match.</strong><span>Play draws a random opponent and difficulty, then reveals your rival while the arena prepares.</span></li>
            <li><strong>Learn inside the arena.</strong><span>Your first Quick Match pauses for a controls tour. Finish or skip it to start fighting.</span></li>
          </ol></div>
        </section>

        <section id="guide-characters"><h2 tabIndex={-1}>Characters</h2><p>Five fighters are available now: three free starters, Veyra, and Mawren. More are coming soon. Learn each fighter's openings and weaknesses.</p>
          <div className="guide-starter-summary">{STARTER_FIGHTER_IDS.map(id => <a key={id} href={'#guide/characters'} onClick={() => document.getElementById('guide-fighter-' + id)?.setAttribute('open', '')}>
            <FighterPortrait id={id}/><div><strong>{CHAMPIONS[id].name}</strong><span>{id === 'karen' ? 'Balanced swordplay' : id === 'taren' ? 'Shield and spear' : 'Heavy close combat'}</span></div>
          </a>)}</div>
          <div className="guide-roster">{FIGHTER_IDS.map(id => {
            const fighter = CHAMPIONS[id];
            return <details key={id} id={'guide-fighter-' + id} className="guide-fighter" open={id === 'karen'}><summary><div><strong>{fighter.name}</strong><span>{fighter.title}</span></div><small>{!playableFighter(id) ? 'COMING SOON' : fighter.tier === 'Basic' ? 'FREE STARTER' : fighter.tier.toUpperCase()}</small></summary>
              <div className="guide-fighter-detail"><p>{fighter.description}</p><dl><div><dt>Identity</dt><dd>{fighter.identity}</dd></div><div><dt>Weapon</dt><dd>{fighter.weapon}</dd></div><div><dt>Signature: {fighter.specialName}</dt><dd>{fighter.signature}</dd></div><div><dt>Ultimate</dt><dd>{fighter.ultimateName}</dd></div><div><dt>Weakness</dt><dd>{fighter.weakness}</dd></div><div><dt>Level 2 / Level 3</dt><dd>{fighter.upgrades.join(' / ')}</dd></div></dl>
                {fighter.tier !== 'Basic' && <p className="guide-note">{playableFighter(id) ? 'Unlock' : 'Planned unlock'}: {fighter.cost.toLocaleString()} Embers. Check the character collection for current availability.</p>}
              </div>
            </details>;
          })}</div>
        </section>

        <section id="guide-controls"><h2 tabIndex={-1}>Controls</h2><p>Keyboard, mouse, and touch controls use the same combat system. One Attack control handles both light and heavy strikes.</p>
          <div className="guide-control-table"><table><caption>Keyboard, mouse, and touch controls</caption><thead><tr><th scope="col">Action</th><th scope="col">Keyboard / mouse</th><th scope="col">Touch</th><th scope="col">What it does</th></tr></thead><tbody>{controls.map(([action, key, touch, effect]) => <tr key={action}><th scope="row">{action}</th><td><kbd>{key}</kbd></td><td>{touch}</td><td>{effect}</td></tr>)}</tbody></table></div>
          <p className="guide-note">Touch controls appear on small screens and devices with coarse pointers. Hold directional buttons, Guard, or Sprint for continuous actions.</p>
        </section>

        <section id="guide-combat"><h2 tabIndex={-1}>Combat & rounds</h2><div className="guide-combat-rules">
          <div><Shield size={24}/><h3>Health and stamina</h3><p>Health reaches zero to decide a knockout. Attacks, guards, dodges, and sprinting consume stamina. Give yourself room to recover instead of attacking continuously.</p></div>
          <div><Sword size={24}/><h3>Read an opening</h3><p>Attacks have startup, contact, and recovery. Dodge or parry the incoming strike, then counter during recovery. Heavy attacks can break guards.</p></div>
          <div><Fire size={24}/><h3>Signatures and soul charge</h3><p>Your signature has a cooldown and a stamina cost. Combat builds soul charge. A full charge makes your ultimate available; watch the ability buttons.</p></div>
        </div><p>Matches are best of three, with {ROUND_LENGTH} seconds per round. Knock out the opponent or finish with more health when the timer ends. Equal health can produce a tied round. Earn match rewards when the entire duel finishes.</p>
          <p>Ordinary hits stagger fighters. Sustained pressure or a powerful impact can knock them down, followed by grounded recovery. A fatal defeat has its own surrender animation.</p>
        </section>

        <section id="guide-arenas"><h2 tabIndex={-1}>Arenas</h2><p>Choose your world from Arenas in the lobby. Your selected arena is used for the next Quick Match and appears in your lobby preview.</p>
          <div className="guide-arenas">{ARENA_IDS.map(id => <div key={id} style={{ '--arena-accent': ARENAS[id].color } as CSSProperties}><MapTrifold size={25}/><h3>{ARENAS[id].name}</h3><p>{ARENAS[id].subtitle}</p></div>)}</div>
          <p className="guide-note">In online PvP, the room creator chooses the arena. Both players enter that same world.</p>
        </section>

        <section id="guide-modes"><h2 tabIndex={-1}>Game modes</h2><div className="guide-modes">
          <div><Sword size={27}/><h3>Quick Match</h3><p>Fight a randomly selected computer-controlled opponent with the same attacks, defenses, and signature mechanics as your fighter. Each match also draws Initiate, Warrior, or Master difficulty at random.</p><p>Initiate gives you more time to react. Warrior adds pressure. Master punishes missed attacks and poor stamina management.</p></div>
          <div><UsersThree size={27}/><h3>Online PvP</h3><p>Create a private room and share the room code, or join a friend’s room. Choose Ready after both fighters arrive. The room server runs the shared duel and synchronizes both players.</p><p>Online matches continue while the menu is open. PvP skips the random opponent reveal and first-match tutorial.</p></div>
        </div><p className="guide-note">Story mode is in development. It is shown as Coming Soon in the mode selector.</p></section>

        <section id="guide-embers"><h2 tabIndex={-1}>Embers & upgrades</h2><p>Embers are your in-game currency. Use the character collection to permanently upgrade your fighters from Level 1 to Level 3.</p>
          <dl className="guide-rewards"><div><dt>One-time welcome gift</dt><dd>{ONBOARDING_EMBERS.toLocaleString()} Embers</dd></div><div><dt>Win a completed duel</dt><dd>75 Embers</dd></div><div><dt>Complete a draw</dt><dd>30 Embers</dd></div><div><dt>Complete a loss with a round won</dt><dd>25 Embers</dd></div><div><dt>One free daily spin</dt><dd>25 to 500 Embers</dd></div></dl>
          <div className="guide-upgrades"><div><strong>LEVEL 2</strong><span>{UPGRADE_COST[1]} Embers</span><p>Improved health and damage, plus a fighter-specific improvement.</p></div><ArrowRight size={24}/><div><strong>LEVEL 3</strong><span>{UPGRADE_COST[2]} Embers</span><p>Maximum progression, stronger base performance, and the next fighter-specific improvement.</p></div></div>
          <p>Upgrades belong to the individual character. All three starters remain available. Exiting an unfinished duel does not award match Embers.</p>
        </section>

        <section id="guide-settings"><h2 tabIndex={-1}>Profile & audio</h2><p>Open your player card in the upper left of the lobby to change your name and view matches, wins, and Embers. Your progress is saved in this browser on this device.</p>
          <p>Open the gear icon for Sound and Effects. Sound adjusts background music; Effects adjusts interface, combat, ambience and announcer sounds. The speaker icon toggles mute. Lobby and battle music have separate tracks; your chosen levels apply across the game.</p>
          <p>Sound starts after a click or key press when required by your browser. If a tab is hidden, the game suspends its audio. Quick Matches pause when you leave the tab; return through the match menu.</p>
        </section>

        <section id="guide-faq"><h2 tabIndex={-1}>Frequently asked questions</h2><div className="guide-faq">{FAQS.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
        <footer className="guide-footer"><a href="#home"><ArrowLeft size={16}/>Back to home</a><small>Eminent™</small></footer>
      </article>
    </div>
  </main>;
}
