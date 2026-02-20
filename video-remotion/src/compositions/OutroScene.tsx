import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CameraRig } from "./CameraRig";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // AnimaÃ§Ã£o do tÃ­tulo
  const titleScale = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
    },
    from: 0.8,
    to: 1,
  });

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // AnimaÃ§Ã£o do botÃ£o
  const buttonY = spring({
    frame: frame - 20,
    fps,
    config: {
      damping: 15,
      stiffness: 80,
    },
    from: 40,
    to: 0,
  });

  const buttonOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  // AnimaÃ§Ã£o do texto secundÃ¡rio
  const textY = spring({
    frame: frame - 30,
    fps,
    config: {
      damping: 15,
      stiffness: 80,
    },
    from: 30,
    to: 0,
  });

  const textOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pulso do botÃ£o
  const buttonPulse = interpolate(
    frame,
    [40, 55, 70, 85, 100, 115],
    [1, 1.05, 1, 1.05, 1, 1],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(135deg, hsl(220, 60%, 8%) 0%, hsl(220, 50%, 6%) 50%, hsl(210, 55%, 8%) 100%)",
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
        seed="outro"
        startScale={1.02}
        endScale={1.09}
        startX={10}
        endX={-10}
        startY={0}
        endY={10}
        drift={12}
        exitZoom={0.07}
        exitBlur={12}
      >
      {/* CÃ­rculos decorativos */}
      <div
        style={{
          position: "absolute",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)",
          transform: `translate(${Math.sin(frame / 50) * 20}px, ${
            Math.cos(frame / 50) * 20
          }px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "350px",
          height: "350px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(147, 197, 253, 0.08) 0%, transparent 70%)",
          transform: `translate(${Math.cos(frame / 40) * 30}px, ${
            Math.sin(frame / 40) * 30
          }px)`,
        }}
      />

      {/* Ãcone */}
      <div
        style={{
          transform: `scale(${titleScale})`,
          opacity: titleOpacity,
          marginBottom: "32px",
        }}
      >
        <svg
          width="80"
          height="80"
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
      <h2
        style={{
          fontSize: "64px",
          fontWeight: "700",
          color: "#ffffff",
          margin: "0 0 16px 0",
          transform: `scale(${titleScale})`,
          opacity: titleOpacity,
          letterSpacing: "-2px",
          textAlign: "center",
        }}
      >
        Pronto para revolucionar
        <br />
        seu escritório?
      </h2>

      {/* BotÃ£o CTA */}
      <div
        style={{
          transform: `translateY(${buttonY}px) scale(${buttonPulse})`,
          opacity: buttonOpacity,
          marginTop: "32px",
        }}
      >
        <div
          style={{
            padding: "20px 48px",
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            borderRadius: "12px",
            boxShadow: "0 10px 40px -10px rgba(59, 130, 246, 0.5)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span
            style={{
              fontSize: "22px",
              color: "#ffffff",
              fontWeight: "600",
            }}
          >
            Comece Grátis
          </span>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: "#ffffff" }}
          >
            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Texto secundÃ¡rio */}
      <p
        style={{
          fontSize: "18px",
          color: "#64748b",
          margin: "32px 0 0 0",
          transform: `translateY(${textY}px)`,
          opacity: textOpacity,
        }}
      >
        JurisDesk - Gestão Jurídica Inteligente
      </p>

      {/* Hashtags */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginTop: "24px",
          transform: `translateY(${textY * 0.8}px)`,
          opacity: textOpacity,
        }}
      >
        {["#Advocacia", "#GestãoJurídica", "#IA"].map((tag, i) => (
          <span
            key={tag}
            style={{
              fontSize: "14px",
              color: "#475569",
              padding: "6px 12px",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      </CameraRig>
    </AbsoluteFill>
  );
};
