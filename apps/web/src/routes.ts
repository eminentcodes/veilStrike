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
export const ROUTES = {
  landing: '/',
  matchmaking: '/matchmaking',
  crewReady: '/crew-ready',
  mine: '/mine',
} as const;

export type RouteKey = keyof typeof ROUTES;
