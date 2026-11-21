import { track } from "@vercel/analytics";
import type { StoreEvents } from "./analytics-events";

/** Analytics must never prevent an add, submission, or navigation from completing. */
export function trackStoreEvent<Name extends keyof StoreEvents>(name: Name, properties: StoreEvents[Name]) {
  if (typeof window === "undefined") return;
  try {
    // Child effects can run before the root Analytics component initializes its queue.
    window.va ??= (event, properties) => { (window.vaq ??= []).push([event, properties]); };
    track(name, properties);
  } catch {
    // Shopping still works when analytics is blocked or unavailable.
  }
}
