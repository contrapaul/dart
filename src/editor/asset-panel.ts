import {
  assetProblem, assetsFileName, assetsFileText, deleteAsset, fitImport, freeName, listAssets, putAsset,
  readAssetsFile, tidyName, type Asset, type AssetBody,
} from "./assets";
import type { Clip } from "./clipboard";

// ED-23: the Assets panel, built into the page's dialog. It saves the
// selection as an asset, lists the saved ones as pictures, and exports and
// imports them as a file. The rules are in src/editor/assets.ts.

export interface AssetPanelHost {
  /** What is selected, as a clip. */
  selection(): Clip;
  /** A picture of a clip's things as they are drawn now. */
  picture(clip: Clip): string;
  /** Arms an asset, to be placed by a click in the view. */
  place(asset: Asset): void;
}

function button(text: string, act: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = text;
  el.addEventListener("click", act);
  return el;
}

function download(assets: AssetBody[]) {
  const url = URL.createObjectURL(new Blob([assetsFileText(assets)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = assetsFileName(assets);
  link.click();
  URL.revokeObjectURL(url);
}

export function buildAssetPanel(body: HTMLElement, host: AssetPanelHost) {
  let assets: Asset[] = [];

  const save = document.createElement("div");
  save.className = "row";
  const name = document.createElement("input");
  name.type = "text";
  name.placeholder = "Name";
  name.className = "asset-name";
  name.maxLength = 60;
  const note = document.createElement("div");
  note.className = "hint asset-note";
  const grid = document.createElement("div");
  grid.className = "asset-grid";
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".json,application/json";
  file.hidden = true;

  const fail = (e: unknown) => {
    note.textContent = `The browser would not store that: ${(e as Error).message}`;
  };

  const saveSelection = () => {
    const clip = host.selection();
    const problem = assetProblem(clip, assets.length);
    if (problem) {
      note.textContent = problem;
      return;
    }
    const wanted = tidyName(name.value);
    if (!wanted) {
      note.textContent = "Give it a name first.";
      name.focus();
      return;
    }
    const body: AssetBody = { name: freeName(wanted, assets.map((a) => a.name)), clip, picture: host.picture(clip) };
    void putAsset(body).then((made) => {
      name.value = "";
      note.textContent = `Saved ${made.name}.`;
      return refresh();
    }).catch(fail);
  };
  name.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveSelection();
  });
  save.append(name, button("Save selection", saveSelection));

  const files = document.createElement("div");
  files.className = "row";
  files.append(
    button("Export all", () => {
      if (assets.length) download(assets);
      else note.textContent = "There is nothing to export yet.";
    }),
    button("Import", () => file.click()),
    file,
  );
  file.addEventListener("change", () => {
    const picked = file.files?.[0];
    file.value = "";
    if (!picked) return;
    void picked.text().then(async (text) => {
      const read = readAssetsFile(text);
      if (read.error) {
        note.textContent = read.error;
        return;
      }
      const fit = fitImport(read.assets, assets);
      for (const asset of fit.assets) await putAsset(asset);
      note.textContent = `Imported ${fit.assets.length}.${fit.left ? ` ${fit.left} left out: the cap is reached.` : ""}`;
      await refresh();
    }).catch(fail);
  });

  const tile = (asset: Asset): HTMLElement => {
    const el = document.createElement("div");
    el.className = "asset";
    const pick = button("", () => host.place(asset));
    pick.className = "asset-pick";
    pick.title = `Place ${asset.name}`;
    if (asset.picture) {
      const img = document.createElement("img");
      img.src = asset.picture;
      img.alt = asset.name;
      pick.append(img);
    } else pick.textContent = asset.name;
    const rename = document.createElement("input");
    rename.type = "text";
    rename.value = asset.name;
    rename.maxLength = 60;
    rename.title = "Rename";
    rename.addEventListener("change", () => {
      const wanted = tidyName(rename.value);
      if (!wanted || wanted === asset.name) {
        rename.value = asset.name;
        return;
      }
      const others = assets.filter((a) => a.key !== asset.key).map((a) => a.name);
      void putAsset({ ...asset, name: freeName(wanted, others) }, asset.key, asset.saved).then(refresh).catch(fail);
    });
    const row = document.createElement("div");
    row.className = "row";
    row.append(
      button("Export", () => download([asset])),
      button("Delete", () => {
        void deleteAsset(asset.key).then(() => {
          note.textContent = `Deleted ${asset.name}.`;
          return refresh();
        }).catch(fail);
      }),
    );
    el.append(pick, rename, row);
    return el;
  };

  async function refresh() {
    assets = await listAssets();
    grid.replaceChildren(...assets.map(tile));
    if (!assets.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "No assets yet. Select things in the level, give them a name here and save.";
      grid.append(empty);
    }
  }

  body.append(save, note, files, grid);
  void refresh().catch(fail);
}
