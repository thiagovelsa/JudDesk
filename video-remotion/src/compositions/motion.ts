import { Easing, interpolate } from "remotion";

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const interpEase = (
  frame: number,
  input: [number, number],
  output: [number, number]
) =>
  interpolate(frame, input, output, {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

// Simple deterministic hash to vary motion per scene without randomness.
export const hash01 = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
};

