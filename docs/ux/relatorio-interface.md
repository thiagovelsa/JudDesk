# RelatÃ³rio de AnÃ¡lise de Interface & UX - JudDesk

> Status (16/02/2026): anÃ¡lise diagnÃ³stica histÃ³rica. Use este documento como checklist de UX, validando cada item com a implementaÃ§Ã£o atual antes de aplicar mudanÃ§as.
>
> Update (16/02/2026): parte do backlog deste relatorio foi executada na entrega de refino visual do dashboard/base. Ver `docs/ux/qa-refino-interface-2026-02-16.md`.
>
> Update (17/02/2026): Assistente IA com persistencia de contexto refinada (modo Tauri):
> - reabre automaticamente a ultima sessao valida;
> - provider/modelo da UI passam a refletir a sessao ativa;
> - troca de provider/modelo com sessao ativa exige confirmacao (nova conversa ou atualizar conversa atual);
> - precedencia de runtime: sessao ativa > defaults (`default_provider`/`default_model`) > fallback interno.

## 1. DiagnÃ³stico Geral
A anÃ¡lise da implementaÃ§Ã£o atual revela uma divergÃªncia significativa entre a especificaÃ§Ã£o original ("Professional & High Density") e a estÃ©tica aplicada ("Noir Elegance").

| Aspecto | EspecificaÃ§Ã£o Original | ImplementaÃ§Ã£o Atual | Impacto na Usabilidade |
|---------|------------------------|---------------------|------------------------|
| **Tema** | Strict Neutral (Zinc/Blue) | Noir Luxury (Black/Gold) | ReduÃ§Ã£o de legibilidade em ambientes iluminados. EstÃ©tica de "app de cripto" vs "software jurÃ­dico". |
| **Cores** | Zinco SÃ³lido + Azul | Preto Mate + Dourado + Gradientes | O contraste do texto dourado sobre preto pode ser cansativo. Gradientes adicionam ruÃ­do visual desnecessÃ¡rio. |
| **Densidade** | Alta (Compacto) | MÃ©dia/Baixa (EspaÃ§ado) | Menos informaÃ§Ãµes visÃ­veis na tela devido a paddings grandes e sombras. |
| **Estilo** | Bordas > Sombras | Sombras + Glassmorphism + Glow | Sombras e "glows" (brilhos) distraem do conteÃºdo textual denso tÃ­pico do direito. |
| **Tipografia** | Inter + Lora (Docs) | Inter + Playfair Display (Display) | `Playfair Display` Ã© excessivamente decorativa para um painel de controle diÃ¡rio. |

## 2. AnÃ¡lise Detalhada

### ðŸŽ¨ Cores & Contraste
O sistema atual utiliza um esquema "Noir" (`#0A0A0A` bg, `#C9A962` primary). Embora visualmente impactante para uma landing page, Ã© inadequado para uso prolongado (8h/dia) em software de produtividade.

*   **Problema:** O uso de Dourado (`#C9A962`) como cor primÃ¡ria cria uma hierarquia visual confusa (tudo parece "premium" ou "vip", diluindo o foco).
*   **Problema:** Fundos puramente pretos (`#000000`) causam "smearing" em telas OLED e cansam a vista pelo contraste extremo com textos brancos.
*   **RecomendaÃ§Ã£o:** Retornar Ã  paleta **Slate/Zinc** (`#0F172A`, `#1E293B`) com acentos em **Azul Indigo** (`#2563EB`) ou **Verde Esmeralda** (`#10B981`) para aÃ§Ãµes positivas. Isso reduz a fadiga ocular.

### ðŸ”  Tipografia
A inclusÃ£o da fonte `Playfair Display` para tÃ­tulos confere um ar de "convite de casamento" ou "revista de moda".

*   **Problema:** Serifas de alto contraste como Playfair sÃ£o difÃ­ceis de ler em tamanhos pequenos ou em telas de baixa densidade.
*   **RecomendaÃ§Ã£o:**
    *   **Interface (UI):** Manter `Inter` (excelente legibilidade).
    *   **Documentos JurÃ­dicos:** Usar `EB Garamond` ou `Lora` (remete Ã  seriedade do papel impresso, ideal para leitura de peÃ§as).
    *   **Dados:** `JetBrains Mono` ou `Geist Mono` para nÃºmeros de processos e datas.

### ðŸ§© Estrutura & Componentes (Cards e BotÃµes)
Os componentes atuais abusam de efeitos visuais que reduzem a Ã¡rea Ãºtil.

*   **Problema:** `rounded-xl` (18px+) e `rounded-2xl` (24px) criam cantos muito arredondados, desperdiÃ§ando espaÃ§o em tabelas e listas.
*   **Problema:** O efeito `glass-card` (vidro fosco) e sombras `shadow-lg` poluem a interface quando hÃ¡ muitos cards na tela.
*   **RecomendaÃ§Ã£o:**
    *   Reduzir `border-radius` para **6px** (`rounded-md`) ou **8px** (`rounded-lg`). Isso transmite precisÃ£o e seriedade.
    *   Substituir sombras por **bordas sutis** (`border-zinc-800`). Em interfaces densas, bordas definem melhor o espaÃ§o sem adicionar "sujeira" visual.
    *   Remover gradientes de fundo dos cards.

### âš¡ AnimaÃ§Ãµes
O sistema define animaÃ§Ãµes lentas (`--duration-slow: 350ms`) e complexas (`shimmer`, `glow`).

*   **RecomendaÃ§Ã£o:** Acelerar transiÃ§Ãµes para **150ms-200ms**. Advogados precisam de resposta instantÃ¢nea, nÃ£o de "navegaÃ§Ã£o cinematogrÃ¡fica".

### EspaÃ§amento & Densidade (Aproveitamento de Tela)
O layout atual privilegia respiro e ornamentaÃ§Ã£o (paddings altos, gaps grandes, raios e botÃµes volumosos). Em um sistema jurÃ­dico desktop, isso vira custo direto: mais scroll, mais perda de contexto e leitura mais lenta.

*   **Problema:** Padding global do conteÃºdo e `gap` entre seÃ§Ãµes/cards tende a ficar alto (ex.: uso frequente de `gap-6`, `p-5`/`p-6` e `rounded-xl`). Isso reduz a densidade e aumenta o tempo para varrer a tela.
*   **Problema:** `max-w` relativamente estreito (ex.: `max-w-[1200px]`) em monitores maiores cria â€œfaixas vaziasâ€ laterais, desperdiÃ§ando largura Ãºtil para tabelas/listas.
*   **Problema:** Tabelas e listas com `py` alto (ex.: `py-4`) e `px` alto (ex.: `px-5`) ficam bonitas, mas ficam pouco produtivas.
*   **RecomendaÃ§Ã£o (alvos de densidade):**
    *   **Padding de pÃ¡gina:** `p-4` (mobile) e `md:p-6` (desktop) como padrÃ£o; evitar `md:p-8` exceto em telas muito vazias.
    *   **Gap entre blocos:** `gap-4` como padrÃ£o; `gap-6` apenas para separaÃ§Ãµes de â€œmacro-seÃ§Ã£oâ€.
    *   **Cards:** padding `p-4` por padrÃ£o; `p-5`/`p-6` apenas em telas de leitura (ex.: configuraÃ§Ãµes longas).
    *   **Altura de linha/itens:** linhas de tabela em **36-40px** (equivalente a `py-2`/`py-2.5`); listas em **52-60px** quando tÃªm 2 linhas.
*   **RecomendaÃ§Ã£o (padrÃ£o de layout):** permitir um **modo compacto** (toggle em ConfiguraÃ§Ãµes) que reduza `paddings`, `gaps`, `radius` e `row heights` sem alterar tipografia.

### ConsistÃªncia de Tokens (espaÃ§o, cor, radius)
HÃ¡ mistura de padrÃµes (uso de `var(--color-...)` em alguns pontos e classes como `bg-surface-dark`, `bg-background-dark`, `text-white` em outros). Isso dificulta evoluir densidade e tema com seguranÃ§a.

*   **Problema:** Ajustes de espaÃ§o e contraste exigem mexer em muitos lugares (classes ad-hoc), ao invÃ©s de alterar poucos tokens.
*   **RecomendaÃ§Ã£o:** centralizar decisÃµes em tokens (cores, bordas, radius e densidade) e fazer componentes/pÃ¡ginas consumirem esses tokens de forma consistente.

## 3. Guia de Melhorias (Design System Recomendado)

Baseado na anÃ¡lise de sistemas jurÃ­dicos de alta performance:

### Paleta Proposta (Slate & Blue)
```css
:root {
  --bg-app: #0f172a;       /* Slate 900 - Fundo principal (nÃ£o preto puro) */
  --bg-panel: #1e293b;     /* Slate 800 - Sidebar/Cards */
  --bg-hover: #334155;     /* Slate 700 */
  
  --border-subtle: #334155; /* Slate 700 */
  --border-focus: #3b82f6;  /* Blue 500 */
  
  --text-primary: #f8fafc;  /* Slate 50 */
  --text-secondary: #94a3b8; /* Slate 400 */
  
  --primary: #3b82f6;       /* Blue 500 - AÃ§Ã£o Principal */
  --primary-hover: #2563eb; /* Blue 600 */
}
```

### Checklist de Ajustes na Interface

#### Sidebar
- [ ] Remover avatar com gradiente. Usar logo monocromÃ¡tico ou Ã­cone simples.
- [ ] Remover sombras projetadas (`shadow-lg`).
- [ ] Ajustar hover dos itens para ser mais sutil (apenas mudanÃ§a de cor de fundo, sem deslocamento).
- [ ] Considerar modo "colapsado" (apenas Ã­cones) para aumentar largura de trabalho em telas menores.

#### Dashboard
- [ ] Remover background gradiente dos cards de estatÃ­sticas.
- [ ] Alinhar mÃ©tricas pela *baseline* do texto para facilitar leitura rÃ¡pida.
- [ ] Substituir Ã­cones "duotone" ou com glow por Ã­cones **stroke** (linhas finas) consistentes (Lucide React jÃ¡ estÃ¡ em uso, manter `stroke-width={1.5}`).
- [ ] Reduzir espaÃ§amento vertical: `gap-6` -> `gap-4` e `p-5` -> `p-4` nos cards principais.
- [ ] Reduzir padding de cÃ©lulas em tabelas: `px-5 py-4` -> `px-4 py-2.5` (mais itens visÃ­veis sem perder legibilidade).

#### Tabelas (Data Grids)
- [ ] Reduzir altura das linhas (density: compact).
- [ ] Usar fonte monoespaÃ§ada para datas e valores monetÃ¡rios.
- [ ] Remover zebrado excessivo; usar apenas bordas divisÃ³rias finas.
- [ ] Fixar cabeÃ§alho (sticky) quando houver scroll vertical longo.
- [ ] Padronizar alinhamento: datas/nÃºmeros Ã  direita; texto Ã  esquerda; status/labels centralizados.

#### Listagens (Clientes, Documentos, HistÃ³rico)
- [ ] Oferecer alternÃ¢ncia "Cards" vs "Tabela/Lista" (a tabela geralmente Ã© superior para varredura rÃ¡pida).
- [ ] Revisar alturas fixas de cards (ex.: 180-200px) e reduzir quando o conteÃºdo real for pequeno.
- [ ] Diminuir `rounded-xl` para `rounded-lg`/`rounded-md` em grids densos.
- [ ] Revisar espaÃ§amento interno de cards: reduzir `p-5` para `p-4` e remover Ã­cones decorativos grandes que nÃ£o agregam informaÃ§Ã£o.

#### Header + Busca Global
- [ ] Reduzir altura do header se necessÃ¡rio (`h-16` -> `h-14`) para recuperar Ã¡rea Ãºtil.
- [ ] Garantir alinhamento do eixo esquerdo (Sidebar, tÃ­tulo e conteÃºdo) com paddings consistentes.
- [ ] Melhorar densidade do dropdown da busca: reduzir `py-2` para `py-1.5` nos itens e reforÃ§ar separadores por grupo.

#### FormulÃ¡rios e Modais
- [ ] Padronizar padding de modal (`p-5`) e espaÃ§amento entre campos (`space-y-4`), evitando formulÃ¡rios â€œaltosâ€ demais.
- [ ] Preferir layout em 2 colunas no desktop para cadastros longos (Cliente/Caso), reduzindo scroll.
- [ ] Fixar barra de aÃ§Ãµes no rodapÃ© do modal quando houver overflow (Salvar/Cancelar sempre visÃ­veis).

#### Acessibilidade
- [ ] Garantir contraste mÃ­nimo de 4.5:1 em todos os textos (o dourado atual falha em fundos claros/mÃ©dios).
- [ ] Focar em navegaÃ§Ã£o por teclado (focus rings visÃ­veis).
- [ ] Garantir Ã¡reas clicÃ¡veis com no mÃ­nimo 36x36px sem depender de padding exagerado (melhor para precisÃ£o e densidade).

## ConclusÃ£o
Para um sistema jurÃ­dico, a **confianÃ§a** vem da **clareza e precisÃ£o**, nÃ£o do luxo visual. Recomenda-se uma migraÃ§Ã£o do tema "Noir" para um tema "SaaS Profissional" (inspirado em Linear, Vercel ou sistemas jurÃ­dicos modernos), priorizando a densidade de informaÃ§Ã£o e a neutralidade cromÃ¡tica.

O ganho mais rÃ¡pido (alto impacto / baixo risco) tende a vir de **reduzir espaÃ§amentos** (padding/gap/row-height) e **padronizar tokens**. Isso aumenta a informaÃ§Ã£o por tela, reduz scroll e melhora o ritmo de leitura sem reescrever fluxos.
