import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { IntroScene } from "./IntroScene";
import { FeatureScene } from "./FeatureScene";
import { OutroScene } from "./OutroScene";
import { ZoomThroughOverlay } from "./ZoomThroughOverlay";

interface JurisDeskVideoProps {
  images: {
    dashboard: string;
    clientes: string;
    novoCliente: string;
    documentos: string;
    agenda: string;
    novoPrazo: string;
    assistenteIA: string;
    historico: string;
    configuracoes: string;
    notificacoes: string;
    bancoDados: string;
  };
}

export const JurisDeskVideo: React.FC<JurisDeskVideoProps> = ({ images }) => {
  // Timings (em frames a 30fps)
  const INTRO_DURATION = 5 * 30; // 5 segundos
  const FEATURE_DURATION = 4 * 30; // 4 segundos por feature
  const OUTRO_DURATION = 5 * 30; // 5 segundos
  const CUT_OVERLAY_DURATION = 14;

  const features = [
    {
      image: images.dashboard,
      title: "Dashboard Intuitivo",
      description: "Visão Geral",
      subtitle:
        "Acompanhe clientes, prazos, casos e documentos em tempo real em um único painel",
    },
    {
      image: images.novoCliente,
      title: "Gestão de Clientes",
      description: "Cadastro Completo",
      subtitle:
        "Cadastre clientes com CPF/CNPJ, dados de contato, endereço e anexe documentos",
    },
    {
      image: images.documentos,
      title: "Organização de Documentos",
      description: "Pasta Inteligente",
      subtitle:
        "Organize documentos em pastas personalizadas: Contratos, Procurações, Petições",
    },
    {
      image: images.agenda,
      title: "Agenda de Prazos",
      description: "Calendário Visual",
      subtitle:
        "Visualize prazos em calendÃ¡rio mensal com navegação intuitiva e alertas",
    },
    {
      image: images.assistenteIA,
      title: "Assistente JurÃ­dico IA",
      description: "Inteligência Artificial",
      subtitle:
        "Análise de casos, elaboração de peças processuais e pesquisa de jurisprudência",
    },
    {
      image: images.bancoDados,
      title: "Backup Automático",
      description: "Segurança Total",
      subtitle:
        "Backup automÃ¡tico dos dados com exportação em JSON e CSV para análises",
    },
  ];

  // Calcular frame inicial de cada seÃ§Ã£o
  const scenes: Array<{
    key: string;
    durationInFrames: number;
    render: () => React.ReactNode;
  }> = [
    {
      key: "intro",
      durationInFrames: INTRO_DURATION,
      render: () => <IntroScene />,
    },
    ...features.map((feature, index) => ({
      key: `feature-${index}`,
      durationInFrames: FEATURE_DURATION,
      render: () => (
        <FeatureScene
          image={feature.image}
          title={feature.title}
          description={feature.description}
          subtitle={feature.subtitle}
        />
      ),
    })),
    {
      key: "outro",
      durationInFrames: OUTRO_DURATION,
      render: () => <OutroScene />,
    },
  ];

  return (
    <AbsoluteFill>
      <TransitionSeries>
        {scenes.map((scene, idx) => (
          <React.Fragment key={scene.key}>
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
              {scene.render()}
            </TransitionSeries.Sequence>
            {idx !== scenes.length - 1 ? (
              <TransitionSeries.Overlay durationInFrames={CUT_OVERLAY_DURATION}>
                <ZoomThroughOverlay durationInFrames={CUT_OVERLAY_DURATION} />
              </TransitionSeries.Overlay>
            ) : null}
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
