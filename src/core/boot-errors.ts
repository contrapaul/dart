// A failed boot says so. Every page's module is a top level await chain, so
// if `createGame` rejects (a model that 404s, no WebGL, a blocked wasm
// fetch) the overlay stays on "Loading" for ever and the console is the only
// clue. Import this module first: module imports run before the importing
// module's body, so the listeners are in place before the first await.
//
// index.html and arena.html carry `#status`, so the player sees the reason.
// The two dev pages do not: there the console gets it and nothing is left
// pretending to load, because the module chain has died.

function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function report(what: string, e: unknown): void {
  console.error("DART: " + what, e);
  const status = document.querySelector<HTMLElement>("#status");
  if (!status) return;
  status.textContent =
    "Could not start: " + describe(e) + ". Reload the page to try again.";
}

window.addEventListener("error", (e) => {
  report("uncaught error", e.error ?? e.message);
});

window.addEventListener("unhandledrejection", (e) => {
  report("unhandled rejection", e.reason);
});

export {};
