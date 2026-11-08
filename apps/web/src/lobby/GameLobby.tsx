import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react';
import { ArrowRight, CaretDown, Check, Crown, Fire, GearSix, HandFist, LockKey, MapTrifold, PersonSimple, Play, Shield, Sparkle, SpeakerHigh, SpeakerSlash, Sword, User, UsersThree, X } from '@phosphor-icons/react';
import { fightAudio } from '@/fight/audio';
import { AudioSettings } from '@/audio/AudioSettings';
import type { Difficulty, MatchResult } from '@/fight/types';
import { CHAMPIONS, ARENAS, FIGHTER_IDS, PLAYABLE_FIGHTER_IDS, playableFighter, ARENA_IDS, levelHealth } from '@/duel/catalog';
import type { ArenaId, DuelConfig, DuelMode, ChampionId } from '@/duel/catalog';
import { DuelRenderer } from '@/duel/DuelRenderer';
import { DuelSimulation } from '@/duel/simulation';
import { DuelGame } from '@/duel/DuelGame';
import { RoomConnection } from '@/duel/network';
import type { RoomInfo } from '@/duel/network';
import { completeOnboarding, rewardMatch, unlockCharacter, upgradeCharacter, UPGRADE_COST, spinEmbers, spinDay, SPIN_REWARDS } from '@/duel/progression';
import type { PlayerProfile } from '@/duel/progression';
import { GuidedTour } from '@/entry/GuidedTour';
import { LOBBY_TOUR } from '@/entry/tours';
import { FighterPortrait } from '@/entry/FighterPortrait';
import { ComingSoon } from './ComingSoon';
import '../duel/duel.css';
import '../duel/lobby.css';

type Panel = 'unlock' | 'embers' | 'spin' | 'characters' | 'mode' | 'arena' | 'profile' | 'audio' | 'controls' | null;
type Screen = 'lobby' | 'network' | 'fight' | 'result';
const icons = { blade: Sword, oath: Shield, grave: HandFist, chain: Sword, rune: Sparkle, snare: Sword, poison: Sword, scatter: Sparkle, divided: UsersThree, furnace: Fire };
export interface GameLobbyProps {
  profile: PlayerProfile;
  setProfile: Dispatch<SetStateAction<PlayerProfile>>;
  active: boolean;
  onReady: (ready: boolean) => void;
  onProgress?: (progress: number) => void;
  onError?: (message: string) => void;
  backdrop?: boolean;
  scenePaused?: boolean;
}
export function GameLobby({ profile, setProfile, active, onReady, onProgress, onError, backdrop = false, scenePaused = false }: GameLobbyProps) {
  const [screen, setScreen] = useState<Screen>('lobby'), [panel, setPanel] = useState<Panel>(null);
  const player = profile.selectedFighter;
  const setPlayer = (selectedFighter: ChampionId) => setProfile(p => ({ ...p, selectedFighter }));
  const [opponent, setOpponent] = useState<ChampionId>('taren');
  const [arena, setArena] = useState<ArenaId>('sanctum'), [difficulty, setDifficulty] = useState<Difficulty>('warrior');
  const [mode, setMode] = useState<DuelMode>('practice'), [result, setResult] = useState<MatchResult | null>(null);
  const [reward, setReward] = useState(0), [signature, setSignature] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const sceneReady = useCallback((ready: boolean) => { setPreviewReady(ready); onReady(ready); }, [onReady]);
  const [muted, setMuted] = useState(() => fightAudio.isMuted()), [levels, setLevels] = useState(() => fightAudio.getLevels());
  const [room, setRoom] = useState<RoomConnection | null>(null), [networkConfig, setNetworkConfig] = useState<DuelConfig | null>(null);
  const roomRef = useRef<RoomConnection | null>(null), matchToken = useRef('');
  const character = CHAMPIONS[player], level = profile.levels[player];
  const config = useMemo<DuelConfig>(() => ({ player, opponent, arena, difficulty, mode, playerLevel: profile.levels[player] ?? 1 }), [player, opponent, arena, difficulty, mode, profile.levels]);
  const previewConfig = useMemo<DuelConfig>(() => backdrop ? { ...config, arena: 'sanctum' } : config, [config, backdrop]);
  useEffect(() => fightAudio.subscribe(() => { setMuted(fightAudio.isMuted()); setLevels(fightAudio.getLevels()); }), []);
  useEffect(() => () => roomRef.current?.dispose(), []);
  useEffect(() => {
    if (!active || screen === 'fight') return;
    fightAudio.suspend(document.hidden); fightAudio.setArena(arena); fightAudio.startMusic('menu');
    const visibility = () => fightAudio.suspend(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); fightAudio.stopMusic(); };
  }, [active, screen, arena]);
  const leave = () => { roomRef.current?.dispose(); roomRef.current = null; setRoom(null); setNetworkConfig(null); setScreen('lobby'); };
  useEffect(() => {
    if (!active) { setPanel(null); roomRef.current?.dispose(); roomRef.current = null; setRoom(null); setNetworkConfig(null); setScreen('lobby'); }
  }, [active]);
  const begin = () => { if (!playableFighter(player) || !profile.levels[player]) { setPanel('unlock'); return; } const choices: Difficulty[] = ['initiate','warrior','master']; setDifficulty(choices[Math.floor(Math.random()*choices.length)]!); const rivals = PLAYABLE_FIGHTER_IDS.filter(id => id !== player); setOpponent(rivals[Math.floor(Math.random() * rivals.length)]!); void fightAudio.unlock(); matchToken.current = crypto.randomUUID(); setPanel(null); setScreen(mode === 'pvp' ? 'network' : 'fight'); };
  const finish = (next: MatchResult) => { roomRef.current?.dispose(); roomRef.current = null; setRoom(null); const earned = rewardMatch(profile, matchToken.current, next); setProfile(earned.profile); setReward(earned.reward); setResult(next); setScreen('result'); };
  if (screen === 'fight') return <DuelGame config={networkConfig ?? config} room={room} onExit={leave} onComplete={finish} active={active} playerName={profile.name} showControlsTutorial={!profile.onboarding.combat} onControlsTutorialComplete={() => setProfile(p => completeOnboarding(p, 'combat'))}/>;
  if (screen === 'network') return <NetworkLobby config={config} onBack={leave} onStart={(connection, next) => { roomRef.current = connection; setRoom(connection); setNetworkConfig(next); setScreen('fight'); }}/>;
  const SignatureIcon = icons[character.skill];
  return <main className="game-lobby" style={{ '--character-accent': character.accent } as CSSProperties}>
    <ScenePreview config={previewConfig} signature={signature} backdrop={backdrop} paused={scenePaused || (!active && !backdrop) || !!panel} onReady={sceneReady} onProgress={onProgress} onError={onError}/><div className="lobby-shade" aria-hidden="true"/>
    <header className="lobby-topbar">
      <button className="player-card" aria-label="Player profile" onClick={() => setPanel('profile')}><span className="player-avatar"><User size={25}/></span><span><strong>{profile.name}</strong><small>WAYFARER · {profile.wins} WINS</small></span><CaretDown size={14}/></button>
      <a className="lobby-brand" href="#home" aria-label="Veilstrike home">VEILSTRIKE<small>THE OATHBOUND ARENA</small></a>
      <div className="lobby-top-actions"><button className="ember-balance" aria-label={`${profile.embers} Embers. Open Ember shop`} onClick={() => setPanel('embers')}><Fire size={21} weight="fill"/><strong>{profile.embers.toLocaleString()}</strong><small>EMBERS</small></button><button className="lobby-icon-button" aria-label="Audio settings" onClick={() => setPanel('audio')}><GearSix size={22}/></button><button className="lobby-icon-button" aria-label={muted ? 'Unmute sound' : 'Mute sound'} onClick={() => fightAudio.toggle()}>{muted ? <SpeakerSlash size={21}/> : <SpeakerHigh size={21}/>}</button></div>
    </header>
    <nav className="lobby-side-nav" aria-label="Lobby controls"><button onClick={() => setPanel('characters')} aria-label="Characters"><PersonSimple size={26}/><span>CHARACTERS</span><small>{PLAYABLE_FIGHTER_IDS.filter(id => profile.levels[id]).length} / {PLAYABLE_FIGHTER_IDS.length}</small></button><button onClick={() => setPanel('arena')} aria-label="Change arena"><MapTrifold size={26}/><span>ARENAS</span><small>{ARENA_IDS.length} WORLDS</small></button><button onClick={() => setPanel('controls')} aria-label="Controls"><Sword size={25}/><span>CONTROLS</span></button></nav>
    <aside className="lobby-character-info" key={player}><p className="lobby-eyebrow">{character.title}</p><h1>{character.name}</h1><p className="character-identity">{character.identity}</p><div className="character-badges"><span>{character.tier.toUpperCase()}</span><span>{level ? `LEVEL ${level}` : 'LOCKED'}</span></div><p className="character-weapon">{character.weapon}</p><button className="signature-button" onClick={() => { setSignature(v => v + 1); fightAudio.ability(character.skill); }}><SignatureIcon size={21}/><span><small>SIGNATURE MOVE</small><strong>{character.specialName}</strong></span><Play size={17} weight="fill"/></button></aside>
    <ComingSoon active={active && !panel}/>
    <button className="lobby-spin-event" onClick={() => setPanel('spin')} aria-label="Daily Ember Spin"><Sparkle size={24}/><small>DAILY EMBER SPIN</small><strong>{profile.spin?.day === spinDay() ? 'REWARD CLAIMED' : 'FREE SPIN'}</strong><span>{profile.spin?.day === spinDay() ? 'Returns tomorrow' : 'Win up to 500 Embers'}</span></button>
    <div className="lobby-stage-caption" aria-hidden="true"><span/>{character.species.toUpperCase()}<span/></div>
    <footer className="lobby-bottom-bar"><div className="lobby-ready"><i/><span>YOUR ARENA AWAITS</span><small>Best of three · {ARENAS[arena].name}</small></div><div className="lobby-launch"><button className="mode-selector" onClick={() => setPanel('mode')} aria-label="Change game mode"><span>{mode === 'practice' ? <Sword size={24}/> : <UsersThree size={24}/>}</span><div><small>GAME MODE</small><strong>{mode === 'practice' ? 'QUICK MATCH' : 'ONLINE PVP'}</strong><em>{mode === 'practice' ? 'RANDOM DIFFICULTY · RANDOM OPPONENT' : 'PRIVATE ARENA · INVITE A FRIEND'}</em></div><CaretDown size={17}/></button><button className="lobby-play" onClick={begin}><span><small>{mode === 'pvp' ? 'CREATE OR JOIN A ROOM' : 'ENTER THE VEIL'}</small><strong>PLAY</strong></span><ArrowRight size={31}/></button></div></footer>
    {panel && <LobbyPanel title={{ unlock: 'Unlock your fighter', embers: 'Ember shop', spin: 'Daily Ember Spin', characters: 'Choose your fighter', mode: 'Choose your battle', arena: 'Choose your arena', profile: 'Your profile', audio: 'Audio settings', controls: 'Know your moves' }[panel]} wide={panel === 'characters'} full={panel === 'mode'} onClose={() => setPanel(null)}>
      {panel === 'unlock' && <div className="unlock-preview"><LockKey size={44} weight="duotone"/><strong>{character.name} IS LOCKED</strong><p>Unlock this fighter before entering a match. You can keep previewing their moves in the lobby.</p><span className="shop-balance">UNLOCK: {character.cost.toLocaleString()} EMBERS · BALANCE: {profile.embers.toLocaleString()}</span><button className="duel-primary" disabled={profile.embers < character.cost || !playableFighter(player)} onClick={() => { setProfile(p => unlockCharacter(p, player)); setPanel(null); }}>UNLOCK {character.name}</button>{profile.embers < character.cost && <><p>Earn {Math.max(0,character.cost-profile.embers).toLocaleString()} more Embers in matches or the daily spin.</p><button className="duel-secondary" onClick={() => setPanel('embers')}>EMBER SHOP</button></>}<button className="duel-secondary" onClick={() => setPanel('characters')}>CHOOSE ANOTHER FIGHTER</button></div>}
      {panel === 'embers' && <div className="unlock-preview"><Fire size={48} weight="duotone"/><span className="shop-coming-label">COMING SOON</span><strong>MORE EMBERS. MORE POSSIBILITIES.</strong><p>Purchase Embers to unlock fighters and grow your collection. The Ember shop is on its way.</p><span className="shop-balance">YOUR BALANCE: {profile.embers.toLocaleString()} EMBERS</span><button className="shop-disabled" disabled>PURCHASE EMBERS — COMING SOON</button><p>For now, earn 75 Embers for a match win, 25 for a loss with a round won, or 30 for a draw. A loss with no round wins earns nothing.</p></div>}
      {panel === 'characters' && <div className="collection-layout"><div>
        <p className="panel-intro">Three basic fighters and two premium fighters are ready for battle. Unlock premium fighters with Embers.</p>
        <div className="roster-grid">{FIGHTER_IDS.map(id => {
          const f = CHAMPIONS[id], Icon = icons[f.skill], owned = profile.levels[id], available = playableFighter(id);
          return <button key={id} disabled={!available} className={'roster-choice ' + (player === id ? 'selected' : '') + (!available ? ' coming-soon' : '')} aria-label={`${f.name} ${available ? 'Select' : 'Coming soon'}`} aria-pressed={player === id} onClick={() => setPlayer(id)} style={{ '--fighter-accent': f.accent } as CSSProperties}>
            <div className="roster-art">{available ? <FighterPortrait id={id}/> : <Icon size={39} weight="duotone"/>}{available ? <span className="roster-level">LV {owned ?? 1}</span> : <LockKey className="roster-lock" size={17}/>}</div>
            <small>{f.tier.toUpperCase()} · {f.species.toUpperCase()}</small><strong>{f.name}</strong><span>{available ? 'SELECT FIGHTER' : 'COMING SOON'}</span>
          </button>;
        })}</div>
      </div><aside className="collection-detail"><div className="collection-model"><ScenePreview config={config} signature={signature} inspection/></div><p className="lobby-eyebrow">{character.title}</p><h2>{character.name}</h2><p>{character.description}</p><dl><dt>SIGNATURE</dt><dd>{character.specialName}</dd><dt>IDENTITY</dt><dd>{character.identity}</dd><dt>OUTFIT</dt><dd>{character.outfit}</dd><dt>WEAKNESS</dt><dd>{character.weakness}</dd></dl><div className="collection-stats"><span>VITALITY <strong>{levelHealth(player, level ?? 1)}</strong></span><span>STAMINA <strong>{character.stamina}</strong></span></div>{!level ? <button className="duel-primary" disabled={profile.embers < character.cost} onClick={() => setProfile(p => unlockCharacter(p, player))}><LockKey size={17}/> UNLOCK {character.name} · {character.cost.toLocaleString()} EMBERS</button> : level < 3 ? <><button className="duel-primary" disabled={profile.embers < UPGRADE_COST[level]} onClick={() => setProfile(p => upgradeCharacter(p, player))}><Crown size={17}/> UPGRADE TO LEVEL {level + 1} · {UPGRADE_COST[level]}</button><small>{character.upgrades[level - 1]}</small></> : <p className="max-level"><Check size={19}/> MAXIMUM LEVEL</p>}</aside></div>}
      {panel === 'mode' && <><p className="panel-intro">Choose your battle. Each arena tests a different kind of courage.</p><div className="battle-mode-cards">
        {([{id:'practice',name:'QUICK MATCH',tag:'ADAPTIVE OPPONENT',image:'sanctum',copy:'Read the opening. Fight a randomly chosen warrior.'},{id:'pvp',name:'ONLINE PVP',tag:'PRIVATE ARENA',image:'forge',copy:'Invite a friend. Two fighters. One arena.'},{id:'story',name:'STORY MODE',tag:'COMING SOON',image:'grove',copy:'A journey through the fractured veil.'}] as const).map(m => <button key={m.id} disabled={m.id==='story'} className={'battle-mode-card '+(mode===m.id?'selected':'')} aria-pressed={mode===m.id} onClick={() => {if(m.id!=='story') setMode(m.id);}}><img src={import.meta.env.BASE_URL+'images/mode-'+m.image+'.png'} alt=""/><span className="mode-card-shade"/><div><small>{m.tag}</small><strong>{m.name}</strong><p>{m.copy}</p>{m.id==='story'?<span className="mode-coming"><LockKey size={16}/> COMING SOON</span>:<span className="mode-select">{mode===m.id?'SELECTED':'CHOOSE MODE'} <ArrowRight size={18}/></span>}</div></button>)}
      </div><div className="mode-screen-footer"><p className="panel-intro">Opponent and difficulty are chosen randomly for each Quick Match.</p><button className="duel-primary" onClick={()=>setPanel(null)}>CONFIRM BATTLE <Check size={18}/></button></div></>}
      {panel === 'arena' && <><p className="panel-intro">Your selected world appears in the lobby.</p><div className="arena-grid">{ARENA_IDS.map(id => <button key={id} className={'panel-option arena-tile ' + (arena === id ? 'selected' : '')} aria-pressed={arena === id} onClick={() => setArena(id)} style={{ '--arena-accent': ARENAS[id].color } as CSSProperties}><MapTrifold size={28}/><strong>{ARENAS[id].name}</strong><span>{ARENAS[id].subtitle}</span>{arena === id && <Check className="option-check" size={18}/>}</button>)}</div><button className="duel-primary panel-confirm" onClick={() => setPanel(null)}>ENTER THIS WORLD <Check size={18}/></button></>}
      {panel === 'profile' && <><p className="panel-intro">Your progress is saved on this device.</p><label className="setup-label" htmlFor="player-name">PLAYER NAME</label><input id="player-name" maxLength={18} value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}/><p className="profile-id">PLAYER ID · {profile.id}</p><div className="profile-stats"><div><strong>{profile.matches}</strong><small>DUELS</small></div><div><strong>{profile.wins}</strong><small>WINS</small></div><div><strong>{profile.embers}</strong><small>EMBERS</small></div></div><p className="panel-intro">Match win: 75 Embers. Lose with a round won: 25. Draw: 30. A loss with no round wins earns nothing.</p><button className="duel-primary panel-confirm" onClick={() => { setProfile(p => ({ ...p, name: p.name.trim() || 'Wayfarer' })); setPanel(null); }}>SAVE PROFILE <Check size={18}/></button></>}
      {panel === 'audio' && <AudioSettings levels={levels}/>}
      {panel === 'spin' && <EmberSpin profile={profile} onChange={setProfile}/>}
      {panel === 'controls' && <div className="lobby-control-guide"><p className="panel-intro">On mobile, drag the left joystick to move. Round buttons on the right form a diamond: Jump above, Grab left, Attack right, and Dodge below. Sprint, Special, and Ultimate sit beside it. Guard and parry use keyboard or mouse. Rotate your phone for a wider arena.</p>{[['WASD','Move around the arena'],['SHIFT','Sprint; costs stamina'],['SPACE','Dodge through an attack'],['C','Jump'],['E','Grab and throw at close range'],['J / LEFT CLICK','Attack once for light; twice quickly for heavy'],['L / RIGHT CLICK','Guard; tap precisely to parry'],['U','Character signature move'],['I','Ultimate; requires full charge'],['TAB','Toggle target lock'],['ESC','Pause or open the match menu']].map(([key,text]) => <div key={key}><kbd>{key}</kbd><span>{text}</span></div>)}</div>}
    </LobbyPanel>}
    {screen === 'result' && result && <LobbyPanel title={result.tied ? 'Stalemate' : result.won ? 'Victory' : 'Rise again'} onClose={leave}><div className="lobby-result"><p className="lobby-eyebrow">THE DUEL IS DECIDED</p><strong>{result.playerRounds}<span>:</span>{result.botRounds}</strong><p>{result.won ? 'Your steel held true.' : result.tied ? 'The arena awaits a rematch.' : 'The next opening is yours.'}</p><div className="result-embers"><Fire size={24} weight="fill"/> +{reward} EMBERS</div><button className="duel-primary" onClick={() => { setNetworkConfig(null); begin(); }}>{mode === 'pvp' ? 'NEW PVP DUEL' : 'REMATCH'}<ArrowRight size={18}/></button><button className="duel-secondary" onClick={leave}>RETURN TO LOBBY</button></div></LobbyPanel>}
    {active && previewReady && screen === 'lobby' && !panel && profile.onboarding.setup && !profile.onboarding.lobby && <GuidedTour kind="lobby" stops={LOBBY_TOUR} values={{ name: profile.name, fighter: character.name }} onComplete={() => setProfile(p => completeOnboarding(p, 'lobby'))}/>}
  </main>;
}
function LobbyPanel({ title, children, wide = false, full = false, onClose }: { title: string; children: ReactNode; wide?: boolean; full?: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => { const element = dialog.current; if (element && !element.open) element.showModal(); return () => { element?.close(); }; }, []);
  return <dialog ref={dialog} className={'lobby-dialog ' + (wide ? 'dialog-wide' : '') + (full ? ' dialog-full' : '')} aria-labelledby="panel-heading" onCancel={e => { e.preventDefault(); closeRef.current(); }} onClick={e => { if (e.target === e.currentTarget) { const b = e.currentTarget.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) closeRef.current(); } }}><header><div><small>VEILSTRIKE</small><h2 id="panel-heading">{title}</h2></div><button className="lobby-icon-button" aria-label="Close panel" onClick={onClose}><X size={23}/></button></header><div className="dialog-content">{children}</div></dialog>;
}
function ScenePreview({ config, signature, inspection = false, paused = false, backdrop = false, onReady, onProgress, onError }: {
  config: DuelConfig; signature: number; inspection?: boolean; paused?: boolean; backdrop?: boolean;
  onReady?: (ready: boolean) => void; onProgress?: (progress: number) => void; onError?: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null), renderer = useRef<DuelRenderer | null>(null);
  const [error, setError] = useState(''), [loaded, setLoaded] = useState(false);
  const presentation = useRef({ paused, backdrop }); presentation.current = { paused, backdrop };
  const callbacks = useRef({ onReady, onProgress, onError }); callbacks.current = { onReady, onProgress, onError };
  const refreshAnimation = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!host.current) return;
    let active = true;
    setError(''); setLoaded(false); callbacks.current.onReady?.(false); callbacks.current.onProgress?.(0);
    let stage: DuelRenderer;
    try { stage = new DuelRenderer(host.current, config, true, true, value => { if (active) callbacks.current.onProgress?.(value); }); }
    catch {
      const message = '3D preview unavailable. Enable hardware acceleration and try again.';
      setError(message); callbacks.current.onError?.(message); return;
    }
    stage.inspection = inspection; renderer.current = stage;
    const snapshot = new DuelSimulation(config).snapshot();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      frame = 0;
      if (!active || document.hidden || presentation.current.paused) return;
      const interval = 1000 / (presentation.current.backdrop ? 24 : 30);
      if (now - last >= interval) { stage.render(snapshot, Math.min(.05, (now - last) / 1000)); last = now; }
      frame = requestAnimationFrame(tick);
    };
    const refresh = () => {
      cancelAnimationFrame(frame); frame = 0; last = performance.now();
      stage.setReducedMotion(motion.matches); stage.setBackdrop(presentation.current.backdrop);
      if (!active || document.hidden || presentation.current.paused) return;
      if (motion.matches && presentation.current.backdrop) stage.render(snapshot, 0);
      else if (stage.fighters[0].model || presentation.current.backdrop) frame = requestAnimationFrame(tick);
    };
    refreshAnimation.current = refresh;
    stage.setBackdrop(presentation.current.backdrop); stage.render(snapshot, 0); refresh();
    document.addEventListener('visibilitychange', refresh);
    motion.addEventListener('change', refresh);
    const sizeObserver = new ResizeObserver(refresh); sizeObserver.observe(host.current);
    stage.ready.then(() => {
      if (!active) return;
      // Warm the selected fighter's GPU resources before returning to the arena-only home view.
      stage.setBackdrop(false); stage.render(snapshot, .05);
      stage.setBackdrop(presentation.current.backdrop); stage.render(snapshot, 0);
      setLoaded(true); callbacks.current.onReady?.(true); refresh();
    }).catch(() => {
      if (!active) return;
      const message = 'Your fighter could not load. Check your connection and try again.';
      setError(message); callbacks.current.onError?.(message);
    });
    if (import.meta.env.DEV) Object.assign(window, { __veilstrikeLobby: stage });
    return () => {
      active = false; cancelAnimationFrame(frame); sizeObserver.disconnect();
      document.removeEventListener('visibilitychange', refresh); motion.removeEventListener('change', refresh);
      refreshAnimation.current = null; renderer.current = null; stage.destroy();
    };
  }, [config.player, config.arena, inspection]);
  useEffect(() => { refreshAnimation.current?.(); }, [paused, backdrop]);
  useEffect(() => { if (signature) renderer.current?.showSignature(); }, [signature]);
  return <div ref={host} className="lobby-scene" data-ready={loaded} data-presentation={backdrop ? 'arena' : 'fighter'} aria-hidden="true">{error && <span className="preview-error">{error}</span>}</div>;
}

function NetworkLobby({ config, onBack, onStart }: { config: DuelConfig; onBack: () => void; onStart: (room: RoomConnection, config: DuelConfig) => void }) {
  const [code, setCode] = useState(''), [name, setName] = useState('Warrior'), [info, setInfo] = useState<RoomInfo | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
  const connection = useRef<RoomConnection | null>(null), transferred = useRef(false), unsubscribe = useRef<(() => void) | null>(null);
  useEffect(() => () => { unsubscribe.current?.(); if (!transferred.current) connection.current?.dispose(); }, []);
  const open = async (join: boolean) => {
    if (busy) return;
    setBusy(true); setError('');
    connection.current?.dispose(); unsubscribe.current?.();
    const room = new RoomConnection(); connection.current = room;
    unsubscribe.current = room.subscribe(() => {
      if (room.error) { setError(room.error); setBusy(false); }
      if (room.info) { setInfo(room.info); setBusy(false); }
      if (room.config && !transferred.current) { transferred.current = true; onStart(room, room.config); }
    });
    try { await room.connect(); if (join) room.join(code.trim().toUpperCase(), config.player, name); else room.create(config.player, config.arena, name); }
    catch (failure) { room.dispose(); setError(failure instanceof Error ? failure.message : 'Could not connect.'); setBusy(false); }
  };
  return <main className="veil-lobby"><header className="veil-nav"><button className="veil-wordmark" onClick={onBack}>VEILSTRIKE<span>THE OATHBOUND ARENA</span></button><button className="veil-sound" onClick={onBack}>← BACK TO LOADOUT</button></header><section className="lobby-panel"><p className="veil-kicker">A CHALLENGE BETWEEN WARRIORS</p><h1>Meet in the veil.</h1><p>Create a private arena. Share the code. Settle it with steel.</p>{!info ? <><label className="setup-label" htmlFor="warrior-name">YOUR NAME</label><input id="warrior-name" maxLength={20} value={name} onChange={event => setName(event.target.value)}/><div className="lobby-fighter"><span>{CHAMPIONS[config.player].name}</span><small>{ARENAS[config.arena].name}</small></div><button className="duel-primary" disabled={busy} onClick={() => void open(false)}>{busy ? 'CONNECTING…' : 'CREATE ARENA'}</button><div className="lobby-divider"><span>HAVE A ROOM CODE?</span></div><div className="join-row"><input aria-label="Room code" placeholder="ABCDE" value={code} maxLength={5} autoCapitalize="characters" onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}/><button className="duel-secondary" disabled={busy || code.length !== 5} onClick={() => void open(true)}>JOIN ARENA</button></div></> : <><div className="room-code"><small>INVITE CODE</small><strong>{info.code}</strong><button onClick={() => { void navigator.clipboard.writeText(info.code).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'COPIED' : 'COPY CODE'}</button></div><div className="room-seats">{info.players.map((seat, i) => <div key={i}><small>{i === 0 ? 'HOST' : 'CHALLENGER'}</small><strong>{seat ? CHAMPIONS[seat.fighter].name : 'WAITING'}</strong><span>{seat?.name ?? 'Share the code with a friend'}</span><em>{seat ? seat.ready ? 'READY' : 'PREPARING' : 'OPEN SEAT'}</em></div>)}</div><button className="duel-primary" disabled={!info.players[1] || !!info.players[connection.current?.slot ?? 0]?.ready} onClick={() => connection.current?.ready()}>{info.players[connection.current?.slot ?? 0]?.ready ? 'WAITING FOR OPPONENT' : 'READY TO DUEL'}</button></>}{error && <p className="lobby-error" role="alert">{error}</p>}</section></main>;
}


function EmberSpin({ profile, onChange }: { profile: PlayerProfile; onChange: (p: PlayerProfile) => void }) {
  const [spinning,setSpinning]=useState(false),[rotation,setRotation]=useState(0),[reward,setReward]=useState(0);
  const timer=useRef<number | undefined>(undefined),stopSpin=useRef<(() => void) | undefined>(undefined);
  useEffect(()=>()=>{window.clearTimeout(timer.current);stopSpin.current?.();},[]);
  const claimed=profile.spin?.day===spinDay();
  const spin=()=>{if(claimed||spinning)return;const result=spinEmbers(profile);onChange(result.profile);setSpinning(true);setRotation(1440+360-(result.index*45+22.5));stopSpin.current=fightAudio.sound('spin-wheel-'+result.index,.66);timer.current=window.setTimeout(()=>{stopSpin.current?.();stopSpin.current=undefined;setSpinning(false);setReward(result.reward);fightAudio.sound(result.reward>=250?'ui-jackpot':'ui-reward',.65);},1900);};
  return <div className="ember-spin"><p>One free spin every day. Your Embers go straight into your balance.</p><div className="spin-wheel-wrap"><span className="spin-pointer">▼</span><div className="spin-wheel" style={{transform:`rotate(${rotation}deg)`}}>{SPIN_REWARDS.map((value,i)=><span key={value} style={{transform:`rotate(${i*45+22.5}deg) translateY(-108px) rotate(-${i*45+22.5}deg)`}}>{value}</span>)}<Fire size={34} weight="fill"/></div></div>{reward>0?<strong className="spin-reward">+{reward} EMBERS</strong>:<span>{spinning?'THE EMBERS ARE TURNING':claimed?`Today's reward: ${profile.spin?.reward} Embers`:'Rewards: 25 to 500 Embers'}</span>}<button className="duel-primary" disabled={claimed||spinning} onClick={spin}>{spinning?'SPINNING…':claimed?'RETURNS TOMORROW':'SPIN FOR FREE'}</button></div>;
}
