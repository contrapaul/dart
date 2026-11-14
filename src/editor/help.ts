// ED-09 stage 4: the editor's Help panel. The words are plain and short, and
// they describe what the editor does today, not what it will do. No story,
// no names: the level's own words are Paul's.

export interface HelpSection {
  title: string;
  /** One line per row: a key or a thing, then what it does. */
  rows: [string, string][];
  /** Plain sentences under the rows, when a row is not enough. */
  text?: string[];
}

export const HELP: HelpSection[] = [
  {
    title: "Keys",
    rows: [
      ["Mouse wheel", "Zoom toward the point under the cursor."],
      ["Middle mouse drag", "Pan the camera."],
      ["Right mouse drag", "Look round. Hold it and WASD, Q/E fly, Shift faster."],
      ["Alt + left drag", "Orbit round the point under the cursor."],
      ["F", "Frame what is selected."],
      ["Click, Shift+click", "Select, add to the selection."],
      ["Drag a thing", "Slide it over the floors and walls under the cursor. A shape is clicked first, so a drag on the floor does not move the floor."],
      ["[ and ]", "Turn what is selected by 15 degrees."],
      ["W, E, R", "Move, rotate, scale handles."],
      ["G", "Grid snap on or off."],
      ["Ctrl+D, Delete", "Duplicate, delete."],
      ["Ctrl+Z, Ctrl+Y", "Undo, redo."],
      ["P", "Play from the player start."],
      ["Shift+P", "Play from the camera."],
      ["L, Esc", "Link a trigger's field, then stop linking."],
    ],
  },
  {
    title: "Placing things",
    rows: [
      ["Tool bar", "The icons on the left. Pick a shape or a thing and a see-through copy follows the cursor. Click to place one, or drag on a floor to draw a shape's size. Shift+click keeps the tool. Esc stops."],
      ["Inspector", "The right panel edits what is selected: position, size, colour, behaviour."],
      ["Outliner", "The panel beside the tool bar lists everything. Click a row to select it."],
    ],
    text: [
      "A prim is set to solid, breakable, hazard or decor in the inspector.",
      "Solid stops the player and the Foamers. Decor is drawn and nothing else.",
    ],
  },
  {
    title: "How to make a blocker",
    rows: [
      ["1", "Place a box where the wall should be."],
      ["2", "Set its behaviour to solid."],
      ["3", "Tick hidden in the inspector, so it is not there when the level starts."],
      ["4", "Add a trigger that shows it, and another that hides it."],
    ],
    text: [
      "A blocker is an ordinary prim that starts hidden. The Arena button builds this set for you.",
      "The Hidden things button in the top bar stops drawing hidden prims, so you can see the level as it begins.",
    ],
  },
  {
    title: "The Arena button",
    rows: [
      ["1", "Place a zone where the fight should start, and select it."],
      ["2", "Press Build an arena."],
      ["3", "Tick the blockers, the spawn points and the doors, and set the waves."],
      ["4", "Press Build the triggers."],
    ],
    text: [
      "It writes ordinary triggers: enter the zone, show the blockers, spawn wave 1, then one trigger per further wave, then hide the blockers and open the doors.",
      "Every trigger can be changed afterwards in the inspector. The message words are yours to write.",
    ],
  },
  {
    title: "Keys and doors",
    rows: [
      ["Key pickup", "A pickup of type key, with a colour: red, blue or yellow."],
      ["Key door", "A door locked to that colour. It opens when the player walks up holding the key."],
      ["Trigger door", "A door a trigger opens. Set its lock to trigger."],
    ],
    text: ["The player's keys are shown on the HUD and are lost at the level exit."],
  },
  {
    title: "Hazards and breakables",
    rows: [
      ["Hazard", "A prim set to hazard. It hurts by a damage per second you set, and can slow the player."],
      ["Breakable box", "A box set to breakable. Darts carve it and blasts break it."],
      ["Breakable shape", "Any other shape takes a number of hits, then shatters into foam."],
    ],
    text: [
      "A hazard has no floor of its own. Put a solid floor under it and the player wades through.",
      "Foamers walk round hazards, and one knocked into one takes its damage.",
    ],
  },
  {
    title: "Saving and sharing",
    rows: [
      ["Autosave", "Every change is saved in this browser half a second after you stop."],
      ["Open", "Opens a saved level, or a built in level as a copy."],
      ["Export", "Writes one file, name.dart.json, with everything in it."],
      ["Import", "Opens one of those files."],
    ],
    text: [
      "A level lives in this browser until you export it. Export is how you move it to another machine or send it to a friend.",
      "A built in level opens as a copy. Saving it makes a new level and leaves the original alone.",
    ],
  },
];

/** Builds the Help panel's body into `host`. */
export function buildHelp(host: HTMLElement): void {
  for (const section of HELP) {
    const heading = document.createElement("h3");
    heading.textContent = section.title;
    host.append(heading);
    const list = document.createElement("div");
    list.className = "help-rows";
    for (const [what, does] of section.rows) {
      const row = document.createElement("div");
      row.className = "help-row";
      const key = document.createElement("span");
      key.className = "help-key";
      key.textContent = what;
      const text = document.createElement("span");
      text.textContent = does;
      row.append(key, text);
      list.append(row);
    }
    host.append(list);
    for (const line of section.text ?? []) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = line;
      host.append(p);
    }
  }
}
