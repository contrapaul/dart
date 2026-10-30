import { greedyMesh } from "./mesher";
import { surfaceNets } from "./surface-nets";
import { linearColorTable } from "./materials";

export interface MeshRequest {
  id: number;
  padded: Uint8Array;
  /** Surface nets (Foamers) instead of greedy blocks. */
  smooth: boolean;
}

const colors = linearColorTable();

self.onmessage = (e: MessageEvent<MeshRequest>) => {
  const t0 = performance.now();
  const mesh = e.data.smooth ? surfaceNets(e.data.padded, colors) : greedyMesh(e.data.padded, colors);
  const ms = performance.now() - t0;
  (self as unknown as Worker).postMessage({ id: e.data.id, mesh, ms }, [
    mesh.positions.buffer, mesh.normals.buffer, mesh.colors.buffer, mesh.indices.buffer,
  ]);
};
