import { ONBOARDING_EMBERS } from '@/duel/progression';

export interface TourStop { target: string; title: string; body: string; keys?: string[]; }

export const LOBBY_TOUR: TourStop[] = [
  { target: '.lobby-character-info', title: 'Welcome, {name}.', body: '{fighter} is ready for battle. This is your fighter’s profile. Preview the signature move here whenever you want.' },
  { target: '.ember-balance', title: 'Your welcome gift is here.', body: 'You have received ' + ONBOARDING_EMBERS.toLocaleString() + ' Embers. Spend them on fighter unlocks and upgrades in Characters.' },
  { target: '.lobby-side-nav button[aria-label="Characters"]', title: 'Find your fighting style.', body: 'Karen, Taren, and Nomet are all free. Open Characters to switch fighters, inspect their abilities, and upgrade them with Embers.' },
  { target: '.lobby-side-nav button[aria-label="Change arena"]', title: 'Choose your battleground.', body: 'Open Arenas to choose the world for your next duel. The lobby previews the arena you select.' },
  { target: '.lobby-spin-event', title: 'Collect your daily Embers.', body: 'Take one free spin every day for 25 to 500 Embers. Completed matches also earn Embers for your character upgrades.' },
  { target: '.mode-selector', title: 'Train or challenge a friend.', body: 'Quick Match draws a random opponent and difficulty. Online PvP lets you invite a friend to a private room.' },
  { target: '.lobby-play', title: 'Your first duel awaits.', body: 'Press Play when you’re ready. Your first Quick Match includes a controls walkthrough before the fighting starts.' },
];

export const COMBAT_TOUR: TourStop[] = [
  { target: '.duel-hud', title: 'Keep an eye on your fighter.', body: 'The upper bar is health; the smaller bar is stamina. Attacks, guarding, sprinting, and dodging use stamina. Win two rounds to win the duel.' },
  { target: '.duel-controls-legend, .duel-touch-dpad', title: 'Move and reposition.', body: 'Move around the arena with WASD. Hold Shift to sprint, or press C to jump. On touch screens, use the directional buttons and Sprint or Jump.', keys: ['W A S D', 'SHIFT', 'C'] },
  { target: '.duel-controls-legend, .duel-touch-actions', title: 'One control. Two attacks.', body: 'Press J or left-click once for a light attack. Press twice quickly for a heavy attack. Heavy strikes hit harder but leave a longer opening. Press E to grab at close range.', keys: ['J / LEFT CLICK', 'DOUBLE PRESS', 'E'] },
  { target: '.duel-controls-legend, .duel-touch-actions', title: 'Read the strike. Defend.', body: 'Hold L or right-click to guard. A well-timed tap parries. Press Space to dodge through an incoming attack. On touch screens, use Guard and Dodge.', keys: ['L / RIGHT CLICK', 'SPACE'] },
  { target: '.duel-abilities', title: 'Make your fighter count.', body: 'Press U for {special}. Press I for {ultimate} when your soul charge is full. The ability buttons show cooldowns and charge, and work on touch screens too.', keys: ['U', 'I'] },
  { target: '.duel-toolbar', title: 'You’re ready to fight.', body: 'Tab switches target lock. Escape opens the menu and pauses Quick Matches. Controls are always available in the match menu. Take your time and watch for an opening.', keys: ['TAB', 'ESC'] },
];
