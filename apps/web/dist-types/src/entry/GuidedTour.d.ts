import type { TourStop } from './tours';
import './tour.css';
interface Props {
    stops: TourStop[];
    kind: 'lobby' | 'combat';
    onComplete: () => void;
    values?: Record<string, string>;
    finalLabel?: string;
}
export declare function GuidedTour({ stops, kind, onComplete, values, finalLabel }: Props): import("react").JSX.Element;
export {};
