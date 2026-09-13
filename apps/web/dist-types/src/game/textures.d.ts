import Phaser from 'phaser';
import type { MinePalette } from './palette';
export declare const TILE = 32;
export declare const TEX: {
    readonly floor: "mine-floor";
    readonly floorAlt: "mine-floor-alt";
    readonly rock: "mine-rock";
    readonly crystalL: "mine-crystal-l";
    readonly crystalM: "mine-crystal-m";
    readonly crystalS: "mine-crystal-s";
    readonly timber: "mine-timber";
    readonly lantern: "mine-lantern";
    readonly rail: "mine-rail";
    readonly cart: "mine-cart";
    readonly glow: "mine-glow";
    readonly mote: "mine-mote";
    readonly chip: "mine-chip";
    readonly snare: "mine-snare";
    readonly bat: "mine-bat";
    readonly mite: "mine-mite";
    readonly boulder: "mine-boulder";
    readonly warn: "mine-warn";
    readonly gate: "mine-gate";
    readonly sentinel: "mine-sentinel";
    readonly warden: "mine-warden";
    readonly slash: "mine-slash";
    readonly entrance: "mine-entrance";
};
export declare function buildTextures(scene: Phaser.Scene, p: MinePalette): void;
/**
 * Draw a chunky miner and register it as a texture.
 *
 * One function for the player and the crew so they read as the same species;
 * only the shirt and hat colours differ, which is how the reference art tells
 * Nova / Atlas / Ember apart.
 */
export declare function buildMinerTexture(scene: Phaser.Scene, key: string, p: MinePalette, shirt: number, hat: number): void;
/** Pickaxe, drawn separately so it can swing independently of the body. */
export declare function buildPickaxeTexture(scene: Phaser.Scene, key: string, p: MinePalette): void;
