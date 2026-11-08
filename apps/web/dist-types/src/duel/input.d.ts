import type { InputFrame } from './simulation';
export declare class DuelInput {
    private enabled;
    private held;
    private edges;
    private movement;
    private attack;
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
    private press;
    setEnabled(value: boolean): void;
    inject(code: string, down: boolean): void;
    move(right: number, forward: number): void;
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
