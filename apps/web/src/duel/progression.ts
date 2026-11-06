import { CHAMPIONS, validFighter, playableFighter } from './catalog';
import type { ChampionId, CharacterLevel } from './catalog';
import type { MatchResult } from '../fight/types';

export interface PlayerProfile {
  version: 1; name: string; id: string; embers: number; matches: number; wins: number;
  levels: Partial<Record<ChampionId, CharacterLevel>>; claimed: string[];
  daily: { day: string; matches: number; firstWin: boolean; threeMatches: boolean };
  spin?: { day: string; reward: number };
}
const KEY = 'veilstrike:profile:v1';
export const UPGRADE_COST = { 1: 300, 2: 900, 3: 0 };
export const SPIN_REWARDS = [25, 50, 75, 100, 150, 200, 300, 500];
export const spinDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function spinEmbers(profile: PlayerProfile, random = crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296): { profile: PlayerProfile; index: number; reward: number } {
  if (profile.spin?.day === spinDay()) return { profile, index: SPIN_REWARDS.indexOf(profile.spin.reward), reward: 0 };
  const weights = [40, 25, 16, 10, 5, 2, 1, 1]; let roll = Math.max(0, Math.min(.999999, random)) * 100, index = 0;
  while (index < weights.length - 1 && roll >= weights[index]!) { roll -= weights[index]!; index++; }
  const reward = SPIN_REWARDS[index]!;
  return { profile: { ...profile, embers: profile.embers + reward, spin: { day: spinDay(), reward } }, index, reward };
}
const today = () => new Date().toISOString().slice(0, 10);
export function newProfile(): PlayerProfile {
  return { version: 1, name: 'Wayfarer', id: crypto.randomUUID().slice(0, 8).toUpperCase(), embers: 0, matches: 0, wins: 0,
    levels: { karen: 1, taren: 1, nomet: 1 }, claimed: [], daily: { day: today(), matches: 0, firstWin: false, threeMatches: false } };
}
export function loadProfile(): PlayerProfile {
  const fresh = newProfile();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw?.version !== 1) return fresh;
    fresh.name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 18) || fresh.name : fresh.name;
    fresh.id = typeof raw.id === 'string' ? raw.id.slice(0, 12) : fresh.id;
    for (const key of ['embers', 'matches', 'wins'] as const) if (Number.isSafeInteger(raw[key]) && raw[key] >= 0) fresh[key] = raw[key];
    for (const [id, level] of Object.entries(raw.levels ?? {})) if (validFighter(id) && [1, 2, 3].includes(level as number)) fresh.levels[id] = level as CharacterLevel;
    if (Array.isArray(raw.claimed)) fresh.claimed = raw.claimed.filter((id: unknown) => typeof id === 'string').slice(-80);
    if (raw.daily?.day === today()) fresh.daily = { day: today(), matches: Math.max(0, Number(raw.daily.matches) || 0), firstWin: raw.daily.firstWin === true, threeMatches: raw.daily.threeMatches === true };
    if (raw.spin?.day === spinDay() && SPIN_REWARDS.includes(raw.spin.reward)) fresh.spin = { day: raw.spin.day, reward: raw.spin.reward };
  } catch { /* A private browser profile can still play with the starter roster. */ }
  return fresh;
}
export function saveProfile(profile: PlayerProfile): void { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* Persistence is optional. */ } }
export function unlockCharacter(profile: PlayerProfile, id: ChampionId): PlayerProfile {
  const cost = CHAMPIONS[id].cost;
  if (!playableFighter(id) || profile.levels[id] || profile.embers < cost) return profile;
  return { ...profile, embers: profile.embers - cost, levels: { ...profile.levels, [id]: 1 } };
}
export function upgradeCharacter(profile: PlayerProfile, id: ChampionId): PlayerProfile {
  const level = profile.levels[id]; if (!playableFighter(id) || !level || level === 3 || profile.embers < UPGRADE_COST[level]) return profile;
  return { ...profile, embers: profile.embers - UPGRADE_COST[level], levels: { ...profile.levels, [id]: (level + 1) as CharacterLevel } };
}
export function rewardMatch(profile: PlayerProfile, token: string, result: MatchResult): { profile: PlayerProfile; reward: number } {
  if (profile.claimed.includes(token)) return { profile, reward: 0 };
  const daily = profile.daily.day === today() ? { ...profile.daily } : { day: today(), matches: 0, firstWin: false, threeMatches: false };
  let reward = result.won ? 60 : 25;
  daily.matches++;
  if (result.won && !daily.firstWin) { reward += 75; daily.firstWin = true; }
  if (daily.matches >= 3 && !daily.threeMatches) { reward += 75; daily.threeMatches = true; }
  return { reward, profile: { ...profile, daily, embers: profile.embers + reward, matches: profile.matches + 1, wins: profile.wins + Number(result.won), claimed: [...profile.claimed, token].slice(-80) } };
}
