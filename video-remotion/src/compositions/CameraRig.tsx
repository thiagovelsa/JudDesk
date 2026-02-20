import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { hash01, interpEase, lerp } from "./motion";

export const CameraRig: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
  seed?: string;
  enterFrames?: number;
  exitFrames?: number;
  startScale?: number;
  endScale?: number;
  startX?: number;
  endX?: number;
  startY?: number;
  endY?: number;
  drift?: number;
  exitZoom?: number;
  exitBlur?: number;
}> = ({
  children,
  durationInFrames,
  seed = "default",
  enterFrames = 18,
  exitFrames = 14,
  startScale = 1.0,
  endScale = 1.06,
  startX = 0,
  endX = 0,
  startY = 0,
  endY = 0,
  drift = 10,
  exitZoom = 0.08,
  exitBlur = 10,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: enterFrames,
  });

  const exitT = interpolate(
    frame,
    [durationInFrames - exitFrames, durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const baseT = interpEase(frame, [0, durationInFrames], [0, 1]);
  const baseScale = lerp(startScale, endScale, baseT);
  const baseX = lerp(startX, endX, baseT);
  const baseY = lerp(startY, endY, baseT);

  const h = hash01(seed);
  const driftX = Math.sin(frame / (18 + h * 12)) * drift * (0.7 + h);
  const driftY = Math.cos(frame / (22 + h * 12)) * drift * (0.6 + (1 - h));

  const scale = baseScale * lerp(0.985, 1, enter) * (1 + exitT * exitZoom);
  const x = (baseX + driftX) * lerp(1, 0.7, exitT);
  const y = (baseY + driftY) * lerp(1, 0.7, exitT) + lerp(18, 0, enter);

  const opacity = lerp(0, 1, enter) * (1 - exitT);
  const blur = exitT * exitBlur;

  return (
    <AbsoluteFill
      style={{
        transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        opacity,
        filter: blur > 0.01 ? `blur(${blur}px)` : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

