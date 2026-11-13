// FX-01: the pure part of the blast effect. No THREE, no DOM, so the curve
// can be tested headless. The look numbers come from data/explosion.json fx.

export interface LayerLook {
  readonly durationSeconds: number;
  readonly scaleStart: number;
  readonly scaleEnd: number;
  readonly opacityStart: number;
}

export interface CurveSample {
  scale: number;
  opacity: number;
}

/**
 * The layer's scale and opacity at `age` seconds, for a blast of `radius`
 * metres. It grows linearly and fades linearly to zero at its duration.
 * Writes into `out` so a render frame does not make a new object.
 */
export function sampleCurve(
  layer: LayerLook,
  age: number,
  radius: number,
  out: CurveSample,
): CurveSample {
  if (age >= layer.durationSeconds) {
    out.scale = radius * layer.scaleEnd;
    out.opacity = 0;
    return out;
  }
  const t = age / layer.durationSeconds;
  out.scale = radius * (layer.scaleStart + (layer.scaleEnd - layer.scaleStart) * t);
  out.opacity = layer.opacityStart * (1 - t);
  return out;
}
