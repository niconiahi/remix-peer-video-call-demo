import type { Env } from "~/utils/env";

export const PRODUCTION_ORIGIN = "https://remix-peer-video-call.pages.dev";
export const DEVELOPMENT_ORIGIN = "http://localhost:8788";

export function getOrigin(env: Env) {
  return env.ENVIRONMENT === "development"
    ? DEVELOPMENT_ORIGIN
    : PRODUCTION_ORIGIN;
}

export function toWebsocket(origin: string) {
  return origin.includes("https")
    ? origin.replace("https", "wss")
    : origin.replace("http", "ws");
}
