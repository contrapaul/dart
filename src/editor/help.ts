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
      ["Drag on empty space", "Draw a box and select what is in it. Shift adds."],
      ["Ctrl+C, Ctrl+X, Ctrl+V", "Copy, cut and paste what is selected. Paste lands under the cursor, in this level or another."],
      ["Ctrl+G, Ctrl+Shift+G", "Group what is selected, and take a group apart. A click on one selects the group; a double click picks one."],
      ["Drag a thing", "Slide it over the floors and walls under the cursor. A shape is clicked first, so a drag on the floor does not move the floor."],
      ["[ and ]", "Turn what is selected by 15 degrees. An armed asset turns the same way, as one object about its middle, before it is placed."],
      ["W, E, R", "Move, rotate, scale handles. With two or more things selected they turn and scale as one object about the middle of their box, and a group holding a Foamer, a door or a prop turns about the vertical only."],
      ["R, then drag a face", "With one box selected, each face has a handle. Drag it to pull or push that face; the other side stays put. The size shows by the cursor."],
      ["G", "Grid snap on or off."],
      ["Ctrl+D, Delete", "Duplicate, delete."],
      ["Ctrl+Z, Ctrl+Y", "Undo, redo."],
      ["Tab", "Play from the player start. The level plays over the editor."],
      ["Shift+Tab", "Play from the camera."],
      ["P", "Play from the player start, the same as Tab."],
      ["Shift+P", "Play from the camera, the same as Shift+Tab."],
      ["Esc, while playing", "Back to the editor, as you left it."],
      ["L, Esc", "Link a trigger's field, then stop linking."],
      ["Rotation snap", "The top bar's choice: degrees the rotate handle and grid snap snap to, or Snap off. G turns every snap off and on."],
      ["Lock", "The padlock button on a row (prims, props, physics, models), or the checkbox in the inspector for one thing. A locked thing is drawn, listed and readable, but is never picked in the view, never box selected, never moved, deleted or turned."],
      ["Outliner folds", "Click a group title (solid, Foamers, Logic, Level) to fold it. The count shows while it is folded. Selecting a thing in the view unfolds its group."],
      ["Player start", "The start can be turned by the rotate handle (Y only) and by the [ and ] keys, like a Foamer."],
    ],
  },
  {
    title: "Placing things",
    rows: [
      ["Tool bar", "The icons on the left. Pick a shape or a thing and a see-through copy follows the cursor. Click to place one, or drag on a floor to draw a shape's size. Shift+click keeps the tool. Esc stops."],
      ["Props", "The barrel icon. Pick a barrel, crate, rubble or tank beside it. A prop has a Solid box: off, it is scenery you walk through. The leaking barrel sprays foam when hit and then blows up."],
      ["Inspector", "The right panel edits what is selected: position, size, colour, surface, behaviour."],
      ["Paint tool", "The brush in the Paint group. Pick a surface and an optional colour, then click or drag across prims to set the surface. Shift keeps the tool."],
      ["Light", "The bulb icon. Pick point or spot beside it, then click a surface, a little off it. A spot shows its cone, angle and range; it turns with the rotate handle. The inspector sets kind, colour, intensity, range, angle, softness, a shadow tick and hidden. No more than four lights cast shadows."],
      ["Button", "The Logic group's button icon. Click a surface: it mounts on that face, at that point, and on the thing if you clicked a prim, model or physics object. A press fires the trigger whose when is that button. Its inspector sets what it is mounted on and whether a press needs the use key."],
      ["Physics objects", "The falling object icon. Pick a box, cylinder or ball beside it, then click to place one. The inspector sets its size, colour, surface, mass, damage, bounce and breakable hit points, and whether it starts asleep or hidden. The editor does not simulate: press Play for the drop test, and watch it fall."],
      ["Outliner", "The panel beside the tool bar lists everything. Click a row to select it."],
      ["Import model", "The top bar's Import model button reads a .glb file into the level file (3 MB a model). Pick it in the Models section of the tool bar and click in the view. A model is solid, decor or breakable; a solid one collides as its box, one hull, or its exact mesh."],
      ["Breakable model", "A breakable model takes hit points and bursts into foam. With voxel ticked its inside becomes foam that carves like a wall; a model with more voxels inside than data/editor.json allows is built by hit points instead, and Problems says so."],
      ["Assets", "The Assets button keeps what is selected under a name, with a picture. Pick a saved asset and click in the view to place it as one group, in this level or another. Assets stay in this browser; export them as a file to move them."],
    ],
    text: [
      "A prim is set to solid, breakable, hazard or decor in the inspector.",
      "Solid stops the player and the Foamers. Decor is drawn and nothing else.",
      "With nothing selected, the level's own fields show a Lighting section: ambient colour and intensity, sun colour, intensity, yaw and pitch. Press Default to go back to the arena's own look.",
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
