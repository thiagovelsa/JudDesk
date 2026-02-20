import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CameraRig } from "./CameraRig";
import { hash01, lerp } from "./motion";

interface FeatureSceneProps {
  image: string;
  title: string;
  description: string;
  subtitle?: string;
}

export const FeatureScene: React.FC<FeatureSceneProps> = ({
  image,
  title,
  description,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const DURATION = 4 * fps;

  const exitT = interpolate(frame, [DURATION - 14, DURATION], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const seed = hash01(title + "|" + description);
  const kenT = interpolate(frame, [0, DURATION], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panStartX = lerp(-18, 18, seed);
  const panStartY = lerp(12, -12, 1 - seed);
  const panEndX = -panStartX * 0.7;
  const panEndY = -panStartY * 0.7;

  const kenScale = lerp(1.02, 1.1, kenT);
  const kenX = lerp(panStartX, panEndX, kenT) * lerp(1, 0.7, exitT);
  const kenY = lerp(panStartY, panEndY, kenT) * lerp(1, 0.7, exitT);

  const tiltY = lerp(-6, 4, kenT) + Math.sin(frame / 22) * 0.6;
  const tiltX = lerp(2, -2, kenT) + Math.cos(frame / 26) * 0.5;

  // Animação da imagem
  const imageScale = spring({
    frame,
    fps,
    config: {
      damping: 20,
      stiffness: 100,
    },
    from: 0.85,
    to: 1,
  });

  const imageOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const imageY = spring({
    frame,
    fps,
    config: {
      damping: 15,
      stiffness: 80,
    },
    from: 40,
    to: 0,
  });

  // Animação do texto
  const textX = spring({
    frame: frame - 10,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
    },
    from: -60,
    to: 0,
  });

  const textOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Brilho sutil na imagem
  const glowOpacity = interpolate(
    frame,
    [0, 30, 60, 90],
    [0.3, 0.5, 0.5, 0.3],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(135deg, hsl(220, 50%, 6%) 0%, hsl(220, 45%, 8%) 100%)",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px",
        gap: "60px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      <CameraRig
        durationInFrames={DURATION}
        seed={title}
        startScale={1.01}
        endScale={1.07}
        startX={12}
        endX={-12}
        startY={4}
        endY={-4}
        drift={8}
        exitZoom={0.11}
        exitBlur={12}
      >
      {/* Lado esquerdo - Texto */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          transform: `translateX(${textX}px)`,
          opacity: textOpacity * (1 - exitT * 0.4),
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            padding: "8px 16px",
            background: "rgba(59, 130, 246, 0.15)",
            borderRadius: "8px",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            marginBottom: "24px",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              color: "#60a5fa",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {description}
          </span>
        </div>

        {/* Título */}
        <h2
          style={{
            fontSize: "56px",
            fontWeight: "700",
            color: "#ffffff",
            margin: "0 0 20px 0",
            lineHeight: 1.1,
            letterSpacing: "-1px",
          }}
        >
          {title}
        </h2>

        {/* Subtítulo */}
        {subtitle && (
          <p
            style={{
              fontSize: "22px",
              color: "#94a3b8",
              margin: 0,
              lineHeight: 1.5,
              maxWidth: "480px",
            }}
          >
            {subtitle}
          </p>
        )}

        {/* Linha decorativa */}
        <div
          style={{
            width: "80px",
            height: "4px",
            background: "linear-gradient(90deg, #3b82f6, transparent)",
            borderRadius: "2px",
            marginTop: "32px",
          }}
        />
      </div>

      {/* Lado direito - Screenshot */}
      <div
        style={{
          flex: 1.5,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Glow effect */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(ellipse at center, rgba(59, 130, 246, 0.3) 0%, transparent 70%)",
            opacity: glowOpacity,
            filter: "blur(60px)",
          }}
        />

        {/* Imagem com frame */}
        <div
          style={{
            transform: `perspective(1300px) rotateY(${tiltY}deg) rotateX(${tiltX}deg) translate3d(${kenX}px, ${kenY}px, 0) scale(${
              imageScale * kenScale * (1 + exitT * 0.06)
            }) translateY(${imageY}px)`,
            opacity: imageOpacity * (1 - exitT * 0.2),
            filter: `blur(${exitT * 10}px)`,
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            position: "relative",
            willChange: "transform, opacity, filter",
          }}
        >
          <Img
            src={image}
            style={{
              width: "800px",
              height: "auto",
              display: "block",
            }}
          />

          {/* Shine */}
          <div
            style={{
              position: "absolute",
              top: -220,
              left: -220,
              width: 540,
              height: 540,
              background:
                "radial-gradient(circle, rgba(191, 219, 254, 0.16) 0%, rgba(2, 6, 23, 0) 70%)",
              transform: `translateX(${Math.sin(frame / 18) * 18}px)`,
              mixBlendMode: "screen",
              pointerEvents: "none",
            }}
          />

          {/* Overlay gradiente na parte inferior */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "100px",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.4), transparent)",
            }}
          />
        </div>
      </div>
      </CameraRig>
    </AbsoluteFill>
  );
};
