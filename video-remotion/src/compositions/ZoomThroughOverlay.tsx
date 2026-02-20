import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const ZoomThroughOverlay: React.FC<{
  durationInFrames: number;
}> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();

  const t = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const flash = interpolate(
    frame,
    [
      0,
      Math.floor(durationInFrames * 0.15),
      Math.floor(durationInFrames * 0.5),
      durationInFrames - 1,
    ],
    [0, 0.95, 0.45, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const blur = interpolate(t, [0, 1], [0, 14]);
  const scale = interpolate(t, [0, 1], [1.15, 1.0]);

  const streakX = interpolate(t, [0, 1], [-800, 800]);
  const streakOpacity = interpolate(t, [0, 0.25, 1], [0, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: flash,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
        mixBlendMode: "screen",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(191, 219, 254, 0.95) 0%, rgba(59, 130, 246, 0.55) 22%, rgba(2, 6, 23, 0) 62%)",
        }}
      />

      <AbsoluteFill
        style={{
          opacity: streakOpacity,
          transform: `translateX(${streakX}px)`,
        }}
      >
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(90deg, rgba(2, 6, 23, 0) 0%, rgba(96, 165, 250, 0.85) 40%, rgba(191, 219, 254, 0.65) 50%, rgba(96, 165, 250, 0.85) 60%, rgba(2, 6, 23, 0) 100%)",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

