/**
 * Route paths, kept in one place so screens and navigation never drift.
 *
 * The flow is: landing -> (wallet connect) -> START EXPEDITION -> setup
 * (matchmaking, then crew ready) -> the mine itself.
 *
 * Base Camp is deliberately absent. It is a persistent-hub screen with no
 * bearing on the Veilstrike fighting game experience, so
 * it is deferred to v2 and START EXPEDITION goes straight into setup.
 */
export declare const ROUTES: {
    readonly landing: "/";
    readonly matchmaking: "/matchmaking";
    readonly crewReady: "/crew-ready";
    readonly mine: "/mine";
};
export type RouteKey = keyof typeof ROUTES;
