import type { Input } from "../core/input";
import type { SettingsStore } from "../core/settings";
import { SettingsPanel } from "../ui/menus";
import type { Hud } from "../ui/hud";

// Pause menu, settings panel and the popped screen, shared by both game
// pages (moved out of src/main.ts and src/arena/main.ts, ENG-13). The
// page supplies what it does differently: the arena has a level-complete
// panel that blocks playing on, and a pop that bursts foam blocks.

export interface UIDeps {
  input: Input;
  hud: Hud;
  store: SettingsStore;
  overlay: HTMLElement;
  status: HTMLElement;
  /** The pop's own effect (ground flash, the blaster pop, any page burst). */
  popEffect(): void;
  /** Called on every pause change, for the audio engine. */
  onPause?(paused: boolean): void;
}

export interface UIOptions {
  /** The level-complete panel is up: only Play again unpauses. */
  completeOpen?(): boolean;
  /** The title overlay draws when paused and this is true (the arena
   *  hides it behind the level-complete panel). */
  overlayAllowed?(): boolean;
  /** Respawn after the Restart button (the page's own rules). */
  onRestart?(): void;
  /** Respawn after the Try again button (the arena's checkpoint). */
  onTryAgain?(): void;
  /** Play again on the level-complete panel (the arena only). */
  onPlayAgain?(): void;
}

export interface UIController {
  readonly settingsPanel: SettingsPanel;
  /** True once the mouse has been captured and the title overlay left. */
  started: boolean;
  paused: boolean;
  poppedOut: boolean;
  setPaused(p: boolean): void;
  /** The player popped: show the panel and pause. */
  pop(): void;
  /** Close the popped panel (a restart is about to play on). */
  endPop(): void;
  /** Close the settings and resume, or ask for the pointer lock. */
  play(): void;
}

export function createUI(deps: UIDeps, opts: UIOptions): UIController {
  const completeOpen = opts.completeOpen ?? (() => false);
  const overlayAllowed = opts.overlayAllowed ?? (() => true);
  const { input, hud, store, overlay, status } = deps;

  const popped = document.querySelector<HTMLDivElement>("#popped")!;
  const pauseMenu = document.querySelector<HTMLDivElement>("#pausemenu")!;
  const settingsBtn = document.querySelector<HTMLButtonElement>("#settingsBtn")!;
  const titleSettings = document.querySelector<HTMLButtonElement>("#titleSettings")!;
  const settingsPanel = new SettingsPanel(
    document.querySelector<HTMLDivElement>("#settings")!,
    store,
    () => {
      settingsPanel.close();
      // Back goes to the pause menu when playing was started, otherwise the
      // title overlay is already behind the panel.
      pauseMenu.hidden = !(started && !poppedOut && !completeOpen());
      if (!pauseMenu.hidden) settingsBtn.focus();
    },
  );

  let started = false;
  let paused = true;
  let poppedOut = false;

  /** Resume, or ask for the pointer lock first. */
  function play(): void {
    settingsPanel.close();
    if (input.locked) setPaused(false);
    else input.requestLock();
  }

  /** While paused the menu stands in for "click to play" (the popped and
   *  complete panels have their own buttons instead). */
  function setPaused(p: boolean): void {
    if (poppedOut && !p) return; // Try again clears the flag first
    if (completeOpen() && !p) return; // Play again clears the panel first
    paused = p;
    overlay.hidden = !p || !overlayAllowed();
    hud.show(!p);
    pauseMenu.hidden = !(p && !poppedOut && started && !completeOpen());
    // The title's Settings button is for before the first click; after that
    // Settings lives in the pause menu.
    titleSettings.hidden = started;
    if (!p) settingsPanel.close();
    status.textContent = "Click to play. Esc to pause.";
    deps.onPause?.(p);
    if (p && input.locked) document.exitPointerLock();
  }

  function pop(): void {
    poppedOut = true;
    setPaused(true);
    deps.popEffect();
    popped.hidden = false;
    status.textContent = "Press Try again.";
  }

  function endPop(): void {
    poppedOut = false;
    popped.hidden = true;
  }

  // The panels' buttons.
  document.querySelector<HTMLButtonElement>("#resumeBtn")!.addEventListener("click", play);
  settingsBtn.addEventListener("click", () => settingsPanel.open());
  document.querySelector<HTMLButtonElement>("#restartBtn")!.addEventListener("click", () => {
    opts.onRestart?.();
    endPop();
    play();
  });
  // A click on the dimmed background (not the panel) plays on, like Resume.
  pauseMenu.addEventListener("pointerdown", (e) => {
    if (e.target === pauseMenu) play();
  });
  titleSettings.addEventListener("click", () => {
    pauseMenu.hidden = true;
    settingsPanel.open();
  });
  document.querySelector<HTMLButtonElement>("#tryAgain")!.addEventListener("click", () => {
    // The course has one respawn for both buttons; the arena's Try again
    // goes to the checkpoint instead.
    (opts.onTryAgain ?? opts.onRestart)?.();
    endPop();
    play();
  });
  const playAgain = document.querySelector<HTMLButtonElement>("#playAgain");
  if (playAgain && opts.onPlayAgain) {
    playAgain.addEventListener("click", () => {
      opts.onPlayAgain!();
      play();
    });
  }

  input.onLockChange = (locked) => {
    if (locked) started = true;
    setPaused(!locked);
  };

  return {
    settingsPanel,
    get started() {
      return started;
    },
    set started(v: boolean) {
      started = v;
    },
    get paused() {
      return paused;
    },
    get poppedOut() {
      return poppedOut;
    },
    setPaused,
    pop,
    endPop,
    play,
  };
}
