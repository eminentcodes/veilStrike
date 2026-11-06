import type { ReactNode } from 'react';
export declare const BUTTON_WIDTH = 225;
export declare const BUTTON_HEIGHT = 50;
export declare const BUTTON_PITCH = 58;
interface ButtonProps {
    children: ReactNode;
    onClick?: () => void;
    /** Top edge in design-space px, measured from the panel's top edge. */
    top: number;
    disabled?: boolean;
}
export declare function PrimaryButton({ children, onClick, top, disabled }: ButtonProps): import("react").JSX.Element;
export declare function SecondaryButton({ children, onClick, top, disabled }: ButtonProps): import("react").JSX.Element;
export {};
