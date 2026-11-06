import type { ReactNode } from 'react';
export declare function Modal({ title, subtitle, width, onClose, children, }: {
    title: string;
    subtitle?: string;
    width?: number;
    onClose?: () => void;
    children?: ReactNode;
}): import("react").JSX.Element;
