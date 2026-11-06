import type { CSSProperties, ReactNode } from 'react';
/** Panel copy scales with the viewport; this is the base step. */
export declare const TEXT = "clamp(11px, 1.15vmin, 15px)";
export declare const TEXT_SM = "clamp(9.5px, 0.95vmin, 12.5px)";
export declare const TEXT_LG = "clamp(14px, 1.7vmin, 21px)";
/**
 * The camp outside the mine. `cover` keeps it filling any aspect; the plate is
 * already scrimmed top and bottom so panels sit legibly on it.
 */
export declare function ExpeditionBackdrop({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
/**
 * The wooden headline plate — "PREPARING EXPEDITION" / "CREW READY!" in the art.
 * Wood frame, cream face, heavy dark title, lighter subtitle.
 */
export declare function Banner({ title, subtitle }: {
    title: string;
    subtitle: string;
}): import("react").JSX.Element;
/** The cream card the roster rows and info tables sit in. */
export declare function CreamCard({ children, style, }: {
    children: ReactNode;
    style?: CSSProperties;
}): import("react").JSX.Element;
/** The dark green progress panel at the foot of the Preparing Expedition plate. */
export declare function DarkPanel({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
/** Progress track — brown groove, green fill, as scanned from the art. */
export declare function Track({ value }: {
    value: number;
}): import("react").JSX.Element;
export declare function MinerPortrait({ id, size, dim, }: {
    id: string;
    size?: string;
    dim?: boolean;
}): import("react").JSX.Element;
/** Empty slot marker — the dashed ring drawn beside "Searching for miner...". */
export declare function EmptySlot({ size }: {
    size?: string;
}): import("react").JSX.Element;
/** The three animated dots trailing a row that is still searching. */
export declare function Ellipsis(): import("react").JSX.Element;
/** The green tick beside a confirmed crew member. */
export declare function OkCheck(): import("react").JSX.Element;
