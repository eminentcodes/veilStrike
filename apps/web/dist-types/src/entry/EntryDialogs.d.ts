import type { ChampionId, StarterFighterId } from '@/duel/catalog';
export declare function FirstTimeSetup({ initialName, selectedFighter, onSelect, onComplete, onClose }: {
    initialName: string;
    selectedFighter: ChampionId;
    onSelect: (id: StarterFighterId) => void;
    onComplete: (name: string, fighter: StarterFighterId) => void;
    onClose: () => void;
}): import("react").JSX.Element;
export declare const FAQS: readonly [readonly ["Is Veilstrike free to play?", "Yes. Karen, Taren, and Nomet are free from the start. Play Quick Matches or invite a friend to a private PvP room."], readonly ["How do I earn Embers?", "New players receive a one-time 1,500-Ember welcome gift after setup. A completed win earns 75 Embers, a draw earns 30, and a loss earns 25 if you won a round. The daily spin awards 25 to 500 Embers."], readonly ["Can I play against a friend?", "Choose Online PvP in the lobby. Create a room and share its code, or join with a code from your friend. Both players choose Ready before the match starts."], readonly ["Where is my progress saved?", "Your name, fighter choice, upgrades, Embers, and tutorial progress are saved in this browser on this device. Clearing browser storage removes this local progress."], readonly ["How do I learn the controls?", "Your first Quick Match includes an in-game controls tour. You can also open Controls from the lobby or the match menu, or read the complete game guide."], readonly ["Are more fighters and modes available?", "Five fighters are available now: Karen, Taren, Nomet, Veyra, and Mawren. More fighters are coming soon. The collection shows each fighter’s current availability. Story mode is in development."]];
export declare function FaqDialog({ onClose }: {
    onClose: () => void;
}): import("react").JSX.Element;
