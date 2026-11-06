import type { InputFrame } from './simulation';
export declare class DuelInput {
    private held;
    private edges;
    private host;
    private alternate;
    private onMenu;
    private onLock;
    private onBlur;
    constructor(host: HTMLElement, onMenu: () => void, onLock: () => void, onBlur: () => void, alternate?: boolean);
    private keyDown;
    private keyUp;
    private pointerDown;
    private pointerUp;
    private contextMenu;
    private blur;
    inject(code: string, down: boolean): void;
    sample(basis: {
        forwardX: number;
        forwardZ: number;
        rightX: number;
        rightZ: number;
    }, lockOn?: boolean): InputFrame;
    pulse(code: string): void;
    reset(): void;
    destroy(): void;
}
