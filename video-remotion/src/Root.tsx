import { Composition, staticFile } from "remotion";
import { JurisDeskVideo } from "./compositions/JurisDeskVideo";
import { IntroScene } from "./compositions/IntroScene";
import { FeatureScene } from "./compositions/FeatureScene";
import { OutroScene } from "./compositions/OutroScene";

export const Root: React.FC = () => {
  // Duração total: 5s intro + 6 features × 4s + 5s outro = 34 segundos
  const TOTAL_DURATION = 34 * 30; // 1020 frames a 30fps

  return (
    <>
      {/* Vídeo Principal - 34 segundos */}
      <Composition
        id="JurisDeskVideo"
        component={JurisDeskVideo}
        durationInFrames={TOTAL_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          images: {
            dashboard: staticFile("images/dashboard.png"),
            clientes: staticFile("images/clientes.png"),
            novoCliente: staticFile("images/novo-cliente.png"),
            documentos: staticFile("images/documentos.png"),
            agenda: staticFile("images/agenda.png"),
            novoPrazo: staticFile("images/novo-prazo.png"),
            assistenteIA: staticFile("images/assistente-ia.png"),
            historico: staticFile("images/historico.png"),
            configuracoes: staticFile("images/configuracoes.png"),
            notificacoes: staticFile("images/notificacoes.png"),
            bancoDados: staticFile("images/banco-dados.png"),
          },
        }}
      />

      {/* Cenas individuais para preview */}
      <Composition
        id="IntroScene"
        component={IntroScene}
        durationInFrames={5 * 30}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="FeatureScene"
        component={FeatureScene}
        durationInFrames={4 * 30}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          image: staticFile("images/dashboard.png"),
          title: "Dashboard Intuitivo",
          description: "Visão Geral",
          subtitle: "Acompanhe clientes, prazos, casos e documentos em um só lugar",
        }}
      />

      <Composition
        id="OutroScene"
        component={OutroScene}
        durationInFrames={5 * 30}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
