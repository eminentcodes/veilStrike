import { type ReactNode } from 'react';
interface AudioApi {
    muted: boolean;
    toggleMuted: () => void;
}
export declare function AudioProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useGameAudio(): AudioApi;
export {};
