import './mobile-controls.css';
interface Props {
    enabled: boolean;
    move: (right: number, forward: number) => void;
    inject: (code: string, down: boolean) => void;
    special: {
        name: string;
        cooldown: number;
        duration: number;
        lowStamina: boolean;
    };
    ultimate: {
        name: string;
        charge: number;
    };
}
export declare function MobileControls({ enabled, move, inject, special, ultimate }: Props): import("react").JSX.Element;
export {};
