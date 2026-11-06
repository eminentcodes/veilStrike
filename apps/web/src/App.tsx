import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, ArrowsClockwise, CaretDown, Check, Crown, Fire, GearSix, HandFist, LockKey, MapTrifold, PersonSimple, Play, Shield, Sparkle, SpeakerHigh, SpeakerSlash, Sword, User, UsersThree, X } from '@phosphor-icons/react';
import { fightAudio } from '@/fight/audio';
import type { AudioLevels } from '@/fight/audio';
import type { Difficulty, MatchResult } from '@/fight/types';
import { CHAMPIONS, ARENAS, FIGHTER_IDS, PLAYABLE_FIGHTER_IDS, playableFighter, ARENA_IDS, levelHealth } from '@/duel/catalog';
import type { ArenaId, DuelConfig, DuelMode, ChampionId } from '@/duel/catalog';
import { DuelRenderer } from '@/duel/DuelRenderer';
import { DuelSimulation } from '@/duel/simulation';
import { DuelGame } from '@/duel/DuelGame';
import { RoomConnection } from '@/duel/network';
import type { RoomInfo } from '@/duel/network';
import { loadProfile, saveProfile, rewardMatch, upgradeCharacter, UPGRADE_COST, spinEmbers, spinDay, SPIN_REWARDS } from '@/duel/progression';
import './duel/duel.css';
import './duel/lobby.css';

type Panel = 'spin' | 'characters' | 'mode' | 'arena' | 'profile' | 'audio' | 'controls' | null;
type Screen = 'lobby' | 'network' | 'fight' | 'result';
const icons = { blade: Sword, oath: Shield, grave: HandFist, chain: Sword, rune: Sparkle, snare: Sword, poison: Sword, scatter: Sparkle, divided: UsersThree, furnace: Fire };
export function App() {
  const [screen, setScreen] = useState<Screen>('lobby'), [panel, setPanel] = useState<Panel>(null);
  const [profile, setProfile] = useState(loadProfile);
  const [player, setPlayer] = useState<ChampionId>('karen'), [opponent, setOpponent] = useState<ChampionId>('taren');
  const [arena, setArena] = useState<ArenaId>('sanctum'), [difficulty, setDifficulty] = useState<Difficulty>('warrior');
  const [mode, setMode] = useState<DuelMode>('practice'), [result, setResult] = useState<MatchResult | null>(null);
  const [reward, setReward] = useState(0), [signature, setSignature] = useState(0);
  const [muted, setMuted] = useState(() => fightAudio.isMuted()), [levels, setLevels] = useState(() => fightAudio.getLevels());
  const [room, setRoom] = useState<RoomConnection | null>(null), [networkConfig, setNetworkConfig] = useState<DuelConfig | null>(null);
  const roomRef = useRef<RoomConnection | null>(null), matchToken = useRef('');
  const character = CHAMPIONS[player], level = profile.levels[player];
  const config = useMemo<DuelConfig>(() => ({ player, opponent, arena, difficulty, mode, playerLevel: profile.levels[player] ?? 1 }), [player, opponent, arena, difficulty, mode, profile.levels]);
  useEffect(() => { saveProfile(profile); }, [profile]);
  useEffect(() => fightAudio.subscribe(() => { setMuted(fightAudio.isMuted()); setLevels(fightAudio.getLevels()); }), []);
  useEffect(() => () => roomRef.current?.dispose(), []);
  useEffect(() => {
    let lastHover = 0;
    const hover = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const button = (event.target as HTMLElement).closest('button');
      if (!button || button.disabled || button.contains(event.relatedTarget as Node | null)) return;
      const now = performance.now(); if (now - lastHover < 80) return;
      lastHover = now; fightAudio.hover();
    };
    const click = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest('button');
      if (!button || button.disabled) return;
      void fightAudio.unlock(); fightAudio.press();
    };
    document.addEventListener('pointerover', hover); document.addEventListener('click', click);
    return () => { document.removeEventListener('pointerover', hover); document.removeEventListener('click', click); };
  }, []);

  useEffect(() => {
    if (screen === 'fight') return;
    fightAudio.suspend(document.hidden); fightAudio.setArena(arena); fightAudio.startMusic('menu');
    const visibility = () => fightAudio.suspend(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); fightAudio.stopMusic(); };
  }, [screen, arena]);
  const leave = () => { roomRef.current?.dispose(); roomRef.current = null; setRoom(null); setNetworkConfig(null); setScreen('lobby'); };
  const begin = () => { const rivals = PLAYABLE_FIGHTER_IDS.filter(id => id !== player); setOpponent(rivals[Math.floor(Math.random() * rivals.length)]!); if (!playableFighter(player) || !profile.levels[player]) { setPanel('characters'); return; } void fightAudio.unlock(); matchToken.current = crypto.randomUUID(); setPanel(null); setScreen(mode === 'pvp' ? 'network' : 'fight'); };
  const finish = (next: MatchResult) => { roomRef.current?.dispose(); roomRef.current = null; setRoom(null); const earned = rewardMatch(profile, matchToken.current, next); setProfile(earned.profile); setReward(earned.reward); setResult(next); setScreen('result'); };
  if (screen === 'fight') return <DuelGame config={networkConfig ?? config} room={room} onExit={leave} onComplete={finish}/>;
  if (screen === 'network') return <NetworkLobby config={config} onBack={leave} onStart={(connection, next) => { roomRef.current = connection; setRoom(connection); setNetworkConfig(next); setScreen('fight'); }}/>;
  const SignatureIcon = icons[character.skill];
  return <main className="game-lobby" style={{ '--character-accent': character.accent } as CSSProperties}>
    <ScenePreview config={config} signature={signature} paused={!!panel}/><div className="lobby-shade" aria-hidden="true"/>
    <header className="lobby-topbar">
      <button className="player-card" aria-label="Player profile" onClick={() => setPanel('profile')}><span className="player-avatar"><User size={25}/></span><span><strong>{profile.name}</strong><small>WAYFARER · {profile.wins} WINS</small></span><CaretDown size={14}/></button>
      <div className="lobby-brand">VEILSTRIKE<small>THE OATHBOUND ARENA</small></div>
      <div className="lobby-top-actions"><button className="ember-balance" aria-label={`${profile.embers} Embers. Open character collection`} onClick={() => setPanel('characters')}><Fire size={21} weight="fill"/><strong>{profile.embers.toLocaleString()}</strong><small>EMBERS</small></button><button className="lobby-icon-button" aria-label="Audio settings" onClick={() => setPanel('audio')}><GearSix size={22}/></button><button className="lobby-icon-button" aria-label={muted ? 'Unmute sound' : 'Mute sound'} onClick={() => fightAudio.toggle()}>{muted ? <SpeakerSlash size={21}/> : <SpeakerHigh size={21}/>}</button></div>
    </header>
    <nav className="lobby-side-nav" aria-label="Lobby controls"><button onClick={() => setPanel('characters')} aria-label="Characters"><PersonSimple size={26}/><span>CHARACTERS</span><small>{FIGHTER_IDS.filter(id => profile.levels[id]).length} / 10</small></button><button onClick={() => setPanel('arena')} aria-label="Change arena"><MapTrifold size={26}/><span>ARENAS</span><small>6 WORLDS</small></button><button onClick={() => setPanel('controls')} aria-label="Controls"><Sword size={25}/><span>CONTROLS</span></button></nav>
    <aside className="lobby-character-info" key={player}><p className="lobby-eyebrow">{character.title}</p><h1>{character.name}</h1><p className="character-identity">{character.identity}</p><div className="character-badges"><span>{character.tier.toUpperCase()}</span><span>{level ? `LEVEL ${level}` : 'LOCKED'}</span></div><p className="character-weapon">{character.weapon}</p><button className="signature-button" onClick={() => { setSignature(v => v + 1); fightAudio.ability(character.skill); }}><SignatureIcon size={21}/><span><small>SIGNATURE MOVE</small><strong>{character.specialName}</strong></span><Play size={17} weight="fill"/></button></aside>
    <button className="lobby-spin-event" onClick={() => setPanel('spin')} aria-label="Daily Ember Spin"><Sparkle size={24}/><small>DAILY EMBER SPIN</small><strong>{profile.spin?.day === spinDay() ? 'REWARD CLAIMED' : 'FREE SPIN'}</strong><span>{profile.spin?.day === spinDay() ? 'Returns tomorrow' : 'Win up to 500 Embers'}</span></button>
    <div className="lobby-stage-caption" aria-hidden="true"><span/>{character.species.toUpperCase()}<span/></div>
    <footer className="lobby-bottom-bar"><div className="lobby-ready"><i/><span>YOUR ARENA AWAITS</span><small>Best of three · {ARENAS[arena].name}</small></div><div className="lobby-launch"><button className="mode-selector" onClick={() => setPanel('mode')} aria-label="Change game mode"><span>{mode === 'practice' ? <Sword size={24}/> : <UsersThree size={24}/>}</span><div><small>GAME MODE</small><strong>{mode === 'practice' ? 'AI DUEL' : 'ONLINE PVP'}</strong><em>{mode === 'practice' ? `${difficulty.toUpperCase()} · RANDOM OPPONENT` : 'PRIVATE ARENA · INVITE A FRIEND'}</em></div><CaretDown size={17}/></button><button className="lobby-play" onClick={begin} disabled={!level}><span><small>{mode === 'pvp' ? 'CREATE OR JOIN A ROOM' : 'ENTER THE VEIL'}</small><strong>PLAY</strong></span><ArrowRight size={31}/></button></div></footer>
    {panel && <LobbyPanel title={{ spin: 'Daily Ember Spin', characters: 'Choose your fighter', mode: 'Choose your battle', arena: 'Choose your arena', profile: 'Your profile', audio: 'Audio settings', controls: 'Know your moves' }[panel]} wide={panel === 'characters'} full={panel === 'mode'} onClose={() => setPanel(null)}>
      {panel === 'characters' && <div className="collection-layout"><div>
        <p className="panel-intro">Three free fighters ready for battle. Seven more are coming soon. Earn Embers to upgrade your starters.</p>
        <div className="roster-grid">{FIGHTER_IDS.map(id => {
          const f = CHAMPIONS[id], Icon = icons[f.skill], owned = profile.levels[id], available = playableFighter(id);
          return <button key={id} disabled={!available} className={'roster-choice ' + (player === id ? 'selected' : '') + (!available ? ' coming-soon' : '')} aria-label={`${f.name} ${available ? 'Select' : 'Coming soon'}`} aria-pressed={player === id} onClick={() => setPlayer(id)} style={{ '--fighter-accent': f.accent } as CSSProperties}>
            <div className="roster-art">{available ? <img src={import.meta.env.BASE_URL + 'models/characters/' + id + '-human-' + (id === 'karen' ? 'v3' : 'v1') + '.png'} alt=""/> : <Icon size={39} weight="duotone"/>}{available ? <span className="roster-level">LV {owned ?? 1}</span> : <LockKey className="roster-lock" size={17}/>}</div>
            <small>{f.tier.toUpperCase()} · {f.species.toUpperCase()}</small><strong>{f.name}</strong><span>{available ? 'SELECT FIGHTER' : 'COMING SOON'}</span>
          </button>;
        })}</div>
      </div><aside className="collection-detail"><div className="collection-model"><ScenePreview config={config} signature={signature} inspection/></div><p className="lobby-eyebrow">{character.title}</p><h2>{character.name}</h2><p>{character.description}</p><dl><dt>SIGNATURE</dt><dd>{character.specialName}</dd><dt>IDENTITY</dt><dd>{character.identity}</dd><dt>OUTFIT</dt><dd>{character.outfit}</dd><dt>WEAKNESS</dt><dd>{character.weakness}</dd></dl><div className="collection-stats"><span>VITALITY <strong>{levelHealth(player, level ?? 1)}</strong></span><span>STAMINA <strong>{character.stamina}</strong></span></div>{level && level < 3 ? <><button className="duel-primary" disabled={profile.embers < UPGRADE_COST[level]} onClick={() => setProfile(p => upgradeCharacter(p, player))}><Crown size={17}/> UPGRADE TO LEVEL {level + 1} · {UPGRADE_COST[level]}</button><small>{character.upgrades[level - 1]}</small></> : <p className="max-level"><Check size={19}/> MAXIMUM LEVEL</p>}</aside></div>}
      {panel === 'mode' && <><p className="panel-intro">Choose your battle. Each arena tests a different kind of courage.</p><div className="battle-mode-cards">
        {([{id:'practice',name:'AI DUEL',tag:'ADAPTIVE OPPONENT',image:'sanctum',copy:'Read the opening. Fight a randomly chosen warrior.'},{id:'pvp',name:'ONLINE PVP',tag:'PRIVATE ARENA',image:'forge',copy:'Invite a friend. Two fighters. One arena.'},{id:'story',name:'STORY MODE',tag:'COMING SOON',image:'grove',copy:'A journey through the fractured veil.'}] as const).map(m => <button key={m.id} disabled={m.id==='story'} className={'battle-mode-card '+(mode===m.id?'selected':'')} aria-pressed={mode===m.id} onClick={() => {if(m.id!=='story') setMode(m.id);}}><img src={import.meta.env.BASE_URL+'images/mode-'+m.image+'.png'} alt=""/><span className="mode-card-shade"/><div><small>{m.tag}</small><strong>{m.name}</strong><p>{m.copy}</p>{m.id==='story'?<span className="mode-coming"><LockKey size={16}/> COMING SOON</span>:<span className="mode-select">{mode===m.id?'SELECTED':'CHOOSE MODE'} <ArrowRight size={18}/></span>}</div></button>)}
      </div><div className="mode-screen-footer">{mode==='practice' && <div className="difficulty-options">{(['initiate','warrior','master'] as const).map(id=><button key={id} aria-pressed={difficulty===id} className={difficulty===id?'selected':''} onClick={()=>setDifficulty(id)}>{id.toUpperCase()}</button>)}</div>}<button className="duel-primary" onClick={()=>setPanel(null)}>CONFIRM BATTLE <Check size={18}/></button></div></>}
      {panel === 'arena' && <><p className="panel-intro">Your selected world appears in the lobby.</p><div className="arena-grid">{ARENA_IDS.map(id => <button key={id} className={'panel-option arena-tile ' + (arena === id ? 'selected' : '')} aria-pressed={arena === id} onClick={() => setArena(id)} style={{ '--arena-accent': ARENAS[id].color } as CSSProperties}><MapTrifold size={28}/><strong>{ARENAS[id].name}</strong><span>{ARENAS[id].subtitle}</span>{arena === id && <Check className="option-check" size={18}/>}</button>)}</div><button className="duel-primary panel-confirm" onClick={() => setPanel(null)}>ENTER THIS WORLD <Check size={18}/></button></>}
      {panel === 'profile' && <><p className="panel-intro">Your progress is saved on this device.</p><label className="setup-label" htmlFor="player-name">PLAYER NAME</label><input id="player-name" maxLength={18} value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}/><p className="profile-id">PLAYER ID · {profile.id}</p><div className="profile-stats"><div><strong>{profile.matches}</strong><small>DUELS</small></div><div><strong>{profile.wins}</strong><small>WINS</small></div><div><strong>{profile.embers}</strong><small>EMBERS</small></div></div><p className="panel-intro">Win a duel: 60 Embers. Complete a duel: 25. Your first daily win and third daily duel each earn 75 extra.</p><button className="duel-primary panel-confirm" onClick={() => { setProfile(p => ({ ...p, name: p.name.trim() || 'Wayfarer' })); setPanel(null); }}>SAVE PROFILE <Check size={18}/></button></>}
      {panel === 'audio' && <><p className="panel-intro">Quiet lobby music, a separate battle soundtrack, and layered combat effects.</p><div className="audio-sliders">{(['master','music','effects','voice'] as const).map(key => <label key={key}><span>{key === 'voice' ? 'ANNOUNCER' : key.toUpperCase()}<strong>{Math.round(levels[key] * 100)}%</strong></span><input aria-label={key + ' volume'} type="range" min="0" max="100" value={Math.round(levels[key] * 100)} onChange={e => fightAudio.setLevels({ [key]: Number(e.target.value) / 100 } as Partial<AudioLevels>)}/></label>)}</div><div className="audio-actions"><button className="duel-secondary" onClick={() => { void fightAudio.unlock(); fightAudio.sound('heavy-impact', .8); }}>TEST COMBAT SOUND</button><button className="duel-secondary" onClick={() => fightAudio.resetLevels()}><ArrowsClockwise size={17}/> RESET</button></div></>}
      {panel === 'spin' && <EmberSpin profile={profile} onChange={setProfile}/>}
      {panel === 'controls' && <div className="lobby-control-guide">{[['WASD','Move around the arena'],['SHIFT','Sprint; costs stamina'],['SPACE','Dodge through an attack'],['C','Jump'],['E','Grab and throw at close range'],['J / LEFT CLICK','Light attack; chain your hits'],['K','Heavy attack; pressure a guard'],['L / RIGHT CLICK','Guard; tap precisely to parry'],['U','Character signature move'],['I','Ultimate; requires full charge'],['TAB','Toggle target lock'],['ESC','Pause or open the match menu']].map(([key,text]) => <div key={key}><kbd>{key}</kbd><span>{text}</span></div>)}</div>}
    </LobbyPanel>}
    {screen === 'result' && result && <LobbyPanel title={result.tied ? 'Stalemate' : result.won ? 'Victory' : 'Rise again'} onClose={leave}><div className="lobby-result"><p className="lobby-eyebrow">THE DUEL IS DECIDED</p><strong>{result.playerRounds}<span>:</span>{result.botRounds}</strong><p>{result.won ? 'Your steel held true.' : result.tied ? 'The arena awaits a rematch.' : 'The next opening is yours.'}</p><div className="result-embers"><Fire size={24} weight="fill"/> +{reward} EMBERS</div><button className="duel-primary" onClick={() => { setNetworkConfig(null); begin(); }}>{mode === 'pvp' ? 'NEW PVP DUEL' : 'REMATCH'}<ArrowRight size={18}/></button><button className="duel-secondary" onClick={leave}>RETURN TO LOBBY</button></div></LobbyPanel>}
  </main>;
}
function LobbyPanel({ title, children, wide = false, full = false, onClose }: { title: string; children: ReactNode; wide?: boolean; full?: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => { const element = dialog.current; if (element && !element.open) element.showModal(); return () => { element?.close(); }; }, []);
  return <dialog ref={dialog} className={'lobby-dialog ' + (wide ? 'dialog-wide' : '') + (full ? ' dialog-full' : '')} aria-labelledby="panel-heading" onCancel={e => { e.preventDefault(); closeRef.current(); }} onClick={e => { if (e.target === e.currentTarget) { const b = e.currentTarget.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) closeRef.current(); } }}><header><div><small>VEILSTRIKE</small><h2 id="panel-heading">{title}</h2></div><button className="lobby-icon-button" aria-label="Close panel" onClick={onClose}><X size={23}/></button></header><div className="dialog-content">{children}</div></dialog>;
}
function ScenePreview({ config, signature, inspection = false, paused = false }: { config: DuelConfig; signature: number; inspection?: boolean; paused?: boolean }) {
  const host = useRef<HTMLDivElement>(null), renderer = useRef<DuelRenderer | null>(null); const [error, setError] = useState(''), [loaded, setLoaded] = useState(false); const pausedFrame = useRef(paused); pausedFrame.current = paused;
  useEffect(() => {
    if (!host.current) return;
    let stage: DuelRenderer; setError(''); setLoaded(false);
    try { stage = new DuelRenderer(host.current, config, true); } catch { setError('3D preview unavailable. Enable hardware acceleration.'); return; }
    stage.inspection = inspection; renderer.current = stage; let active = true, frame = 0, last = performance.now(); const simulation = new DuelSimulation(config);
    stage.ready.then(() => { if (active) setLoaded(true); }).catch(() => { if (active) setError('Fighter preview could not load.'); });
    if (import.meta.env.DEV) Object.assign(window, { __veilstrikeLobby: stage });
    const tick = (now: number) => { if (!active) return; const dt = Math.min(.05, (now - last) / 1000); last = now; if (!document.hidden && !pausedFrame.current) stage.render(simulation.snapshot(), dt); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(frame); renderer.current = null; stage.destroy(); };
  }, [config.player, config.arena, inspection]);
  useEffect(() => { if (signature) renderer.current?.showSignature(); }, [signature]);
  return <div ref={host} className="lobby-scene" data-ready={loaded} aria-hidden="true">{error && <span className="preview-error">{error}</span>}</div>;
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


function EmberSpin({ profile, onChange }: { profile: ReturnType<typeof loadProfile>; onChange: (p: ReturnType<typeof loadProfile>) => void }) {
  const [spinning,setSpinning]=useState(false),[rotation,setRotation]=useState(0),[reward,setReward]=useState(0);
  const timer=useRef<number | undefined>(undefined);useEffect(()=>()=>window.clearTimeout(timer.current),[]);
  const claimed=profile.spin?.day===spinDay();
  const spin=()=>{if(claimed||spinning)return;const result=spinEmbers(profile);onChange(result.profile);setSpinning(true);setRotation(1440+360-(result.index*45+22.5));fightAudio.sound('round-start',.5);timer.current=window.setTimeout(()=>{setSpinning(false);setReward(result.reward);fightAudio.sound('victory',.6);},1900);};
  return <div className="ember-spin"><p>One free spin every day. Your Embers go straight into your balance.</p><div className="spin-wheel-wrap"><span className="spin-pointer">▼</span><div className="spin-wheel" style={{transform:`rotate(${rotation}deg)`}}>{SPIN_REWARDS.map((value,i)=><span key={value} style={{transform:`rotate(${i*45+22.5}deg) translateY(-108px) rotate(-${i*45+22.5}deg)`}}>{value}</span>)}<Fire size={34} weight="fill"/></div></div>{reward>0?<strong className="spin-reward">+{reward} EMBERS</strong>:<span>{spinning?'THE EMBERS ARE TURNING':claimed?`Today's reward: ${profile.spin?.reward} Embers`:'Rewards: 25 to 500 Embers'}</span>}<button className="duel-primary" disabled={claimed||spinning} onClick={spin}>{spinning?'SPINNING…':claimed?'RETURNS TOMORROW':'SPIN FOR FREE'}</button></div>;
}
