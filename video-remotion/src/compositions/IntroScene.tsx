import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CameraRig } from "./CameraRig";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // AnimaÃ§Ã£o do fundo
  const bgProgress = interpolate(frame, [0, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  // AnimaÃ§Ã£o do logo/tÃ­tulo
  const logoScale = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
    },
    from: 0,
    to: 1,
    durationInFrames: 30,
  });

  const logoOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // AnimaÃ§Ã£o do subtÃ­tulo
  const subtitleY = spring({
    frame: frame - 20,
    fps,
    config: {
      damping: 15,
      stiffness: 80,
    },
    from: 50,
    to: 0,
  });

  const subtitleOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Gradiente animado
  const gradientPosition = interpolate(frame, [0, 150], [0, 100]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg,
          hsl(220, 70%, ${8 + bgProgress * 5}%) 0%,
          hsl(220, 60%, ${12 + bgProgress * 3}%) 50%,
          hsl(210, 50%, ${15 + bgProgress * 2}%) 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      <CameraRig
        durationInFrames={5 * fps}
        seed="intro"
        startScale={1.02}
        endScale={1.09}
        startX={10}
        endX={-12}
        startY={0}
        endY={10}
        drift={14}
        exitZoom={0.11}
        exitBlur={16}
      >
      {/* CÃ­rculos decorativos animados */}
      <div
        style={{
          position: "absolute",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
          transform: `translate(${Math.sin(frame / 60) * 30}px, ${
            Math.cos(frame / 60) * 30
          }px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(147, 197, 253, 0.1) 0%, transparent 70%)",
          transform: `translate(${Math.cos(frame / 50) * 40}px, ${
            Math.sin(frame / 50) * 40
          }px)`,
        }}
      />

      {/* Ãcone/Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          marginBottom: "32px",
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ color: "#3b82f6" }}
        >
          <path d="M12 3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1" strokeLinecap="round" />
          <path d="M12 8c-1.5-1-3.5-1-5 0s-2 4 0 6 4 2 5 1" strokeLinecap="round" />
          <path d="M12 16c1.5 1 3.5 1 5 0s2-4 0-6-4-2-5-1" strokeLinecap="round" />
          <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
        </svg>
      </div>

      {/* TÃ­tulo principal */}
      <h1
        style={{
          fontSize: "80px",
          fontWeight: "700",
          color: "#ffffff",
          margin: "0 0 16px 0",
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          letterSpacing: "-2px",
          textShadow: "0 4px 30px rgba(59, 130, 246, 0.3)",
        }}
      >
        JurisDesk
      </h1>

      {/* SubtÃ­tulo */}
      <p
        style={{
          fontSize: "28px",
          color: "#94a3b8",
          margin: 0,
          transform: `translateY(${subtitleY}px)`,
          opacity: subtitleOpacity,
          fontWeight: "400",
        }}
      >
        Gestão Jurídica Inteligente
      </p>

      {/* Tagline */}
      <div
        style={{
          marginTop: "48px",
          padding: "12px 24px",
          background: "rgba(59, 130, 246, 0.15)",
          borderRadius: "100px",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          transform: `translateY(${subtitleY * 0.5}px)`,
          opacity: subtitleOpacity,
        }}
      >
        <span
          style={{
            fontSize: "16px",
            color: "#60a5fa",
            fontWeight: "500",
          }}
        >
          Tudo que seu escritório precisa em um só lugar
        </span>
      </div>
      </CameraRig>
    </AbsoluteFill>
  );
};
