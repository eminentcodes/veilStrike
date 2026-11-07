import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { completeSetup, loadProfile, saveProfile } from '@/duel/progression';
import type { StarterFighterId } from '@/duel/catalog';
import type { GameLobbyProps } from '@/lobby/GameLobby';
import { HomePage } from '@/entry/HomePage';
import { FirstTimeSetup, FaqDialog } from '@/entry/EntryDialogs';
import './entry/entry.css';

let lobbyRequest: Promise<typeof import('@/lobby/GameLobby')> | undefined;
const Guide = lazy(() => import('@/entry/GameGuide'));
const readRoute = () => window.location.hash.slice(1) || 'home';

export function App() {
  const [profile, setProfile] = useState(loadProfile);
  const [route, setRoute] = useState(readRoute);
  const [setupOpen, setSetupOpen] = useState(false);
  const [Lobby, setLobby] = useState<ComponentType<GameLobbyProps> | null>(null);
  const [lobbyReady, setLobbyReady] = useState(false);
  const [lobbyAttempt, setLobbyAttempt] = useState(0);
  const [loadError, setLoadError] = useState('');
  const alive = useRef(true);
  const isGuide = route === 'guide' || route.startsWith('guide/');
  const entered = route === 'lobby' && profile.onboarding.setup;

  const prepareLobby = useCallback(() => {
    lobbyRequest ??= import('@/lobby/GameLobby');
    void lobbyRequest.then(module => {
      if (alive.current) { setLoadError(''); setLobby(() => module.GameLobby); }
    }).catch(() => {
      lobbyRequest = undefined;
      if (alive.current) setLoadError('The game could not load. Check your connection and try again.');
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    // Paint home first, then prepare the actual world and lobby in the background.
    let idle = 0, timer = 0;
    const frame = requestAnimationFrame(() => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(prepareLobby, { timeout: 1500 });
      else timer = window.setTimeout(prepareLobby, 150);
    });
    return () => {
      alive.current = false;
      cancelAnimationFrame(frame);
      if (idle) window.cancelIdleCallback(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, [prepareLobby]);

  useEffect(() => { if (route === 'lobby') prepareLobby(); }, [route, prepareLobby]);
  useEffect(() => { saveProfile(profile); }, [profile]);
  useEffect(() => {
    const change = () => { setRoute(readRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    document.title = isGuide ? 'Game guide | Veilstrike' : 'Veilstrike | The Oathbound Arena';
    if (route === 'lobby' && !profile.onboarding.setup) setSetupOpen(true);
  }, [route, isGuide, profile.onboarding.setup]);

  const play = () => {
    prepareLobby();
    if (profile.onboarding.setup) window.location.hash = 'lobby';
    else setSetupOpen(true);
  };
  const setup = (name: string, fighter: StarterFighterId) => {
    setProfile(p => completeSetup(p, name, fighter));
    setSetupOpen(false);
    window.location.hash = 'lobby';
  };
  const retryLobby = () => {
    setLoadError(''); setLobbyReady(false); setLobbyAttempt(value => value + 1); prepareLobby();
  };

  return <div className={'entry-shell' + (isGuide ? ' is-guide' : '')} data-lobby-ready={lobbyReady} data-lobby-prepared={!!Lobby}>
    {Lobby && <div className={'prepared-lobby' + (entered ? ' is-active' : '')} inert={!entered || !lobbyReady} aria-hidden={!entered}>
      <Lobby key={lobbyAttempt} profile={profile} setProfile={setProfile} active={entered} backdrop={!entered}
        scenePaused={isGuide || setupOpen || route === 'faq'} onReady={setLobbyReady} onError={setLoadError}/>
    </div>}
    {!entered && !isGuide && <HomePage worldReady={lobbyReady} onPlay={play} onPrepare={prepareLobby}/>}
    {entered && (!Lobby || !lobbyReady) && <main className="entry-loading entry-curtain" aria-live="polite" aria-busy={!loadError}>
      <img src={import.meta.env.BASE_URL + 'veilstrike-mark.svg'} width="58" height="58" alt=""/>
      <h1>VEILSTRIKE</h1>
      {loadError ? <><p role="alert">{loadError}</p><button className="entry-primary" onClick={retryLobby}>Try again</button></> : <>
        <div className="entry-loading-line" aria-hidden="true"/><p>LOADING</p>
      </>}
      <a className="entry-text-link" href="#home">Back to home</a>
    </main>}
    {isGuide && <Suspense fallback={<main className="entry-loading"><h1>Game guide</h1><div className="entry-loading-line" aria-label="Loading the guide"/></main>}>
      <Guide section={route.split('/')[1]}/>
    </Suspense>}
    {setupOpen && !isGuide && <FirstTimeSetup initialName={profile.name === 'Wayfarer' ? '' : profile.name} selectedFighter={profile.selectedFighter}
      onSelect={selectedFighter => setProfile(p => ({ ...p, selectedFighter }))} onComplete={setup}
      onClose={() => { setSetupOpen(false); if (route === 'lobby') window.location.hash = 'home'; }}/>}
    {route === 'faq' && <FaqDialog onClose={() => { window.location.hash = 'home'; }}/>}
  </div>;
}
