import type { ReactNode } from 'react';
type Variant = 'green' | 'red';
export declare function ModalButton({ variant, onClick, disabled, children, }: {
    variant?: Variant;
    onClick?: () => void;
    disabled?: boolean;
    children: ReactNode;
}): import("react").JSX.Element;
export {};
