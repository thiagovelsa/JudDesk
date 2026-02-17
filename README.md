# JurisDesk

Sistema desktop para escritÃ³rio de advocacia com banco de dados local, gestÃ£o de clientes/documentos, controle de prazos e assistente IA.

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-Local-003B57?logo=sqlite)

## Indice

- [Funcionalidades](#funcionalidades)
  - [Gestao de Clientes](#gestao-de-clientes)
  - [Gestao de Casos](#gestao-de-casos)
  - [Gestao de Documentos](#gestao-de-documentos)
  - [Controle de Prazos](#controle-de-prazos)
  - [Assistente IA](#assistente-ia)
  - [Busca Global](#busca-global)
  - [Historico de Atividades](#historico-de-atividades)
  - [Perfil do Advogado](#perfil-do-advogado)
  - [Backup Automatico](#backup-automatico)
  - [Estado Reativo](#estado-reativo-zustand)
  - [Otimizacoes de Performance](#otimizacoes-de-performance)
- [Stack Tecnologica](#stack-tecnologica)
- [Requisitos](#requisitos)
- [Instalacao](#instalacao)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Banco de Dados](#banco-de-dados)
- [Configuracao de IA](#configuracao-de-ia)
  - [Ollama (Local)](#ollama-local)
  - [Claude API](#claude-api)
  - [OpenAI API](#openai-api)
- [Configuracoes Disponiveis](#configuracoes-disponiveis)
- [Testes](#testes)
- [Scripts Disponiveis](#scripts-disponiveis)
- [Design](#design)
- [Roadmap v2.0](#roadmap-v20)
- [Licenca](#licenca)
- [Contribuicao](#contribuicao)

## Funcionalidades

### Gestao de Clientes
- Cadastro completo (nome, CPF/CNPJ, email, telefone, endereco)
- Anexar documentos diretamente no cadastro do cliente
- Gerenciar documentos no painel de detalhes (adicionar/remover)
- Vinculacao de casos e documentos
- Historico de atividades por cliente

### Gestao de Casos
- Criacao de casos vinculados a clientes
- Numero do processo, tribunal, tipo e status
- Acompanhamento de prazos por caso

### Gestao de Documentos
- Upload de documentos PDF, CSV, XLSX/XLS, DOC/DOCX, TXT/MD
- Sistema de pastas hierarquico com drag & drop
- Extracao automatica de texto de PDFs
- Busca por conteudo extraido
- Arquivos gravados no appData do usuario em `documents/<clientId>/`
- Upload/extracao dependem do ambiente Tauri (`npm run tauri dev`)

### Controle de Prazos
- Calendario visual de prazos
- Niveis de prioridade (baixa, normal, alta, urgente)
- Notificacoes nativas do sistema
- Lembretes configuraveis

### Assistente IA
- Suporte a multiplos provedores:
  - **Ollama** (local, gratuito)
  - **Claude** (Anthropic API)
  - **OpenAI** (GPT-4/GPT-5)
  - **Google Gemini** (Gemini API)
- Anexar arquivos diretamente no chat (PDF, CSV, Excel, Word, TXT)
- Limites de upload: 10 MB/arquivo, 50 MB total, max 5 arquivos
- Contexto de documentos extraidos
- Persistencia de sessoes de chat
- Reabertura automatica da ultima sessao no modo Tauri
- Provider/modelo efetivos seguem a sessao ativa (sem divergencia visual x runtime)
- Troca de provider/modelo com sessao ativa exige confirmacao:
  - criar nova conversa, ou
  - atualizar a conversa atual

### Busca Global
- Busca unificada em clientes, casos, documentos e prazos
- Atalho de teclado (Ctrl+K)
- Navegacao por teclado nos resultados

### Historico de Atividades
- Log automatico de todas as operacoes CRUD
- Filtros por tipo de entidade e acao
- Timeline agrupada por data

### Perfil do Advogado
- Configuracao de nome e registro OAB
- Saudacao dinamica no header (Bom dia/Boa tarde/Boa noite)
- Avatar com iniciais geradas automaticamente

### Backup Automatico
- Backup automatico apos operacoes CRUD (debounce 5s)
- Intervalo minimo entre backups completos (default: 60s) para reduzir I/O em rajadas
- Pasta de backup configuravel
- Rotacao automatica (mantem ultimos N backups)
- Restauracao com um clique
- Lista/status de backups sincronizados automaticamente quando o banco recebe alteracoes

### Estado Reativo (Zustand)
- Carregamento centralizado de todos os dados na inicializacao
- Alteracoes refletem em tempo real em todas as paginas
- Criar/editar/deletar em uma pagina atualiza automaticamente outras
- Secao "Configuracoes > Banco de Dados" atualiza automaticamente status e estatisticas apos mutacoes no SQLite

### Motion Matrix (Performance-First)
- Rota (entrada): `150ms` com easing `ease-route`
- Overlay/Modal (backdrop + painel): `180ms` com easing `ease-overlay`
- Hover (botoes/controles): `130ms` com easing `ease-hover`
- Press (active): `110ms` com easing `ease-hover`
- Regra de performance: animar apenas `opacity`, `transform`, `color` e `border-color`

### Seguranca

Revisao de seguranca implementada (fevereiro/2026):

- **CSP restritivo**: Content Security Policy sem 'unsafe-inline' previne injecao de CSS
- **Path validation**: Caminhos de backup sao validados contra path traversal (apenas AppData/Desktop/Download permitidos)
- **Panic handling**: Hook de panic em Rust para logging antes de encerrar
- **Race condition fix**: Criacao de pastas de cliente com lock atomico
- **JSON validation**: Parse de web search results com validacao de schema
- **Desacoplamento**: Callback pattern entre stores para evitar dependencias circulares

### Acessibilidade

- **ARIA roles**: Menus dropdown com `role="menu"` e `role="menuitem"`
- **Keyboard navigation**: ESC fecha menus, Tab navega entre elementos
- **Screen reader support**: Labels para inputs e botoes icon-only
- **Focus management**: Estados de foco visiveis em todos os elementos interativos

### Otimizacoes de Performance
- **Virtualizacao de listas**: Grids e listas longas usam react-window para renderizar apenas itens visiveis
  - Lista de sessoes de chat (threshold: 50 itens)
  - Lista de mensagens do assistente (virtualizada com `VariableSizeList`)
  - Grid de clientes (threshold: 50 itens)
  - Historico de atividades
- **Lazy loading de texto**: Texto extraido de documentos e carregado sob demanda com cache (10 docs)
- **Paginacao de mensagens**: Chat carrega 50 mensagens por vez com scroll infinito
- **Janela de memoria do chat**: UI mantem os ultimos 100 itens em memoria para reduzir re-render e uso de RAM
- **Extracao em background**: parsing multi-formato usa Web Worker para evitar travamento da interface
- **Queries otimizadas**: Contagem de casos usa query unica ao inves de N+1
- **Memoizacao**: Filtros e listas derivadas usam useMemo/useCallback
- **Cleanup de recursos**: PDFs sao destruidos ao desmontar componente

## Stack Tecnologica

| Camada | Tecnologia |
|--------|------------|
| Runtime | Tauri 2 (Rust) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS 4.x (tokens em `src/index.css`) |
| Estado | Zustand (reativo) |
| Banco | SQLite (tauri-plugin-sql) |
| PDF | pdfjs-dist |
| Drag & Drop | @dnd-kit |
| Virtualizacao | react-window |
| Notificacoes | tauri-plugin-notification |

## Requisitos

- Node.js 20+ (LTS recomendado). O toolchain atual (Vite/Vitest/JSDOM/React Router) exige Node >= 20.
- Rust (stable)
- Tauri prerequisites (v2): `https://v2.tauri.app/start/prerequisites/`

Para usar IA local:
- [Ollama](https://ollama.ai) instalado e rodando

## Instalacao

```bash
# Clonar repositorio
git clone https://github.com/seu-usuario/jurisdesk.git
cd jurisdesk

# Instalar dependencias frontend
npm install

# Executar em modo desenvolvimento
npm run tauri dev

# Build para producao
npm run tauri build
```

Nota (Windows): o script `npm run tauri dev` usa `scripts/tauri-with-rust-env.cjs` para garantir variaveis de ambiente (`PATH`, `CARGO`, `RUSTC`) necessarias ao toolchain Rust/Tauri.

## Estrutura do Projeto

```
src/
â”œâ”€â”€ components/          # Componentes React
â”‚   â”œâ”€â”€ layout/         # Sidebar, Header, MainLayout, SearchBar
â”‚   â”œâ”€â”€ assistant/      # ThinkingBlock, WebSearchResults, MessageCost
â”‚   â”œâ”€â”€ cases/          # CaseForm
â”‚   â”œâ”€â”€ clients/        # ClientForm
â”‚   â”œâ”€â”€ dashboard/      # DashboardSkeleton
â”‚   â”œâ”€â”€ deadlines/      # CalendarGrid, CalendarDay, CalendarDeadline, DeadlineForm
â”‚   â”œâ”€â”€ documents/      # FolderTree, PDFViewer
â”‚   â”œâ”€â”€ settings/       # BackupSettings
â”‚   â””â”€â”€ ui/             # Button, Input, Modal, Card, Badge...
â”œâ”€â”€ lib/                # Utilitarios
â”‚   â”œâ”€â”€ db.ts          # Wrapper SQLite + backup/restore
â”‚   â”œâ”€â”€ ai.ts          # Integracao Claude/OpenAI/Ollama/Gemini
â”‚   â”œâ”€â”€ pdf.ts         # Extracao de texto PDF
â”‚   â”œâ”€â”€ extractors.ts  # Extracao multi-formato (PDF/CSV/Excel/Word/TXT)
â”‚   â”œâ”€â”€ globalSearch.ts # Busca unificada
â”‚   â”œâ”€â”€ activityLogger.ts # Log de atividades
â”‚   â”œâ”€â”€ autoBackup.ts  # Sistema de backup automatico
â”‚   â”œâ”€â”€ attachmentCleanup.ts # Limpeza de anexos orfaos
â”‚   â”œâ”€â”€ documentStorage.ts # Armazenamento local de documentos
â”‚   â””â”€â”€ notifications.ts # Notificacoes nativas
â”œâ”€â”€ stores/            # Estado global (Zustand)
â”‚   â”œâ”€â”€ clientStore.ts
â”‚   â”œâ”€â”€ caseStore.ts
â”‚   â”œâ”€â”€ documentStore.ts
â”‚   â”œâ”€â”€ deadlineStore.ts
â”‚   â”œâ”€â”€ folderStore.ts
â”‚   â”œâ”€â”€ searchStore.ts
â”‚   â”œâ”€â”€ chatStore.ts
â”‚   â””â”€â”€ settingsStore.ts
â”œâ”€â”€ pages/             # Paginas
â”‚   â”œâ”€â”€ Dashboard.tsx
â”‚   â”œâ”€â”€ Clients.tsx
â”‚   â”œâ”€â”€ Documents.tsx
â”‚   â”œâ”€â”€ Calendar.tsx
â”‚   â”œâ”€â”€ Assistant.tsx
â”‚   â”œâ”€â”€ ActivityHistory.tsx
â”‚   â””â”€â”€ Settings.tsx
â”œâ”€â”€ test/              # Setup e cenarios de teste
â””â”€â”€ types/             # Tipos TypeScript

src-tauri/
â”œâ”€â”€ src/main.rs        # Entry point Rust
â”œâ”€â”€ src/lib.rs         # Inicializacao de plugins Tauri
â”œâ”€â”€ Cargo.toml         # Deps Rust
â”œâ”€â”€ tauri.conf.json    # Config Tauri
â””â”€â”€ capabilities/      # Permissoes de plugins
   â””â”€â”€ default.json
```

## Documentacao de Referencia

- `README.md`: guia de uso e operacao (fonte principal para desenvolvimento local)
- `docs/README.md`: indice da documentacao organizada
- `docs/architecture/proposta-sistema-juridico.md`: referencia arquitetural/proposta (pode conter secoes historicas)
- `docs/ux/relatorio-interface.md`: analise de UX e backlog de melhorias visuais
- `docs/roadmap/versao2.md`: funcionalidades planejadas para a proxima versao
- `CLAUDE.md`: regras de implementacao para agentes e padroes internos

## Banco de Dados

SQLite local com as seguintes tabelas:

| Tabela | Descricao |
|--------|-----------|
| `clients` | Clientes do escritorio |
| `cases` | Casos/processos judiciais |
| `documents` | Documentos com texto extraido |
| `document_folders` | Pastas hierarquicas |
| `deadlines` | Prazos e lembretes |
| `chat_sessions` | Sessoes do assistente IA |
| `chat_messages` | Mensagens do chat |
| `settings` | Configuracoes do sistema |
| `activity_logs` | Historico de atividades |

Observacao: `documents.file_path` guarda o caminho local do arquivo em appData.

### Backup e Restore

```typescript
import { exportDatabase, importDatabase } from '@/lib/db'

// Exportar backup JSON
const backup = await exportDatabase()
const json = JSON.stringify(backup, null, 2)

// Importar backup
const backup = JSON.parse(jsonString)
await importDatabase(backup)
```

### Diagnostico em Tempo Real (Configuracoes > Banco de Dados)

- Status de persistencia e estatisticas sao atualizados automaticamente apos mutacoes no SQLite
- Indicador visual mostra `Atualizado agora` e, em seguida, o horario da ultima sincronizacao
- A lista/status de backup tambem sincroniza automaticamente apos alteracoes

## Configuracao de IA

### Ollama (Local)

```bash
# Instalar Ollama
# https://ollama.ai

# Baixar modelo recomendado
ollama pull llama3.1

# O JurisDesk detecta automaticamente modelos disponiveis
```

### Claude API

1. Obter API key em [console.anthropic.com](https://console.anthropic.com)
2. Configurar em Settings > Claude API Key
3. Modelo recomendado: `claude-sonnet-4-20250514`

### OpenAI API

1. Obter API key em [platform.openai.com](https://platform.openai.com)
2. Configurar em Settings > OpenAI API Key
3. Modelo recomendado: `gpt-5-mini`

### Google Gemini API

1. Obter API key em [aistudio.google.com](https://aistudio.google.com)
2. Configurar em Settings > Gemini API Key
3. Modelos recomendados: `models/gemini-3-pro-preview`, `models/gemini-3-flash-preview`

## Configuracoes Disponiveis

Acessiveis em **Settings** (icone de engrenagem):

| Secao | Configuracoes |
|-------|---------------|
| Perfil do Advogado | Nome completo, Registro OAB |
| Interface | Densidade (Normal/Compacto), Movimento (Sistema/Normal/Reduzido) |
| Inteligencia Artificial | API keys (Claude, OpenAI, Gemini), URL Ollama, Provider/Modelo padrao, Thinking/Reasoning, Web Search |
| Notificacoes | Ativar/desativar, Prazos vencidos, Prazos proximos, Antecedencia |
| Banco de Dados | Backup manual, Importar backup, Exportar CSV, Backup automatico |

### Chaves de Configuracao (tabela settings)

```
lawyer_name          # Nome do advogado
lawyer_oab           # Registro OAB
ui_density           # Densidade da UI: normal | compact
ui_motion            # Movimento da UI: system | normal | reduced
claude_api_key       # API key Anthropic
openai_api_key       # API key OpenAI
gemini_api_key       # API key Google Gemini
ollama_url           # URL do Ollama (default: http://localhost:11434)
default_provider     # Provider padrao: ollama | claude | openai | gemini
assistant_last_session_id # Ultima sessao aberta no Assistente (persistencia Tauri)
claude_thinking_enabled   # Claude Extended Thinking
claude_web_search_enabled # Claude Web Search
openai_reasoning_enabled  # OpenAI Reasoning (GPT-5)
openai_web_search_enabled # OpenAI Web Search
gemini_thinking_enabled   # Gemini Thinking Budget
gemini_web_search_enabled # Gemini Google Search Grounding
default_model        # Modelo padrao
notifications_enabled # Notificacoes ativas
notify_overdue       # Notificar prazos vencidos
notify_upcoming      # Notificar prazos proximos
reminder_days        # Dias de antecedencia
auto_backup_enabled  # Backup automatico ativo
auto_backup_path     # Pasta de backups
auto_backup_max_count # Maximo de backups mantidos
auto_backup_min_interval_ms # Intervalo minimo entre backups completos (default: 60000)
```

## Testes

```bash
# Executar todos os testes
npm test

# Executar uma vez (CI)
npm run test:run

# Coverage
npm run test:coverage
```

Nota: `npm test`/`npm run test:*` requer Node.js 20+.

## Scripts Disponiveis

| Script | Descricao |
|--------|-----------|
| `npm run dev` | Inicia Vite dev server |
| `npm run build` | Build de producao |
| `npm run preview` | Preview do build |
| `npm run tauri dev` | Inicia app Tauri em dev (via wrapper `scripts/tauri-with-rust-env.cjs`) |
| `npm run tauri build` | Build do instalador |
| `npm test` | Executa testes |
| `npm run test:run` | Executa testes uma vez |
| `npm run test:coverage` | Executa testes + coverage |

## Design

- **Tema**: Dark mode Zinc/Blue (tokens em `src/index.css`, sem preto puro)
- **Densidade**: Normal ou Compacto (Settings -> Interface, chave `ui_density`)
- **Movimento**: Sistema, Normal ou Reduzido (Settings -> Interface, chave `ui_motion`)
- **Icones**: Lucide React (preferir stroke consistente)
- **Dashboard**: sem widget de entrada do Assistente IA (acesso dedicado pela rota `/assistant`)
- **Componentes**: UI prÃ³pria (Tailwind + componentes em `src/components/ui`)

### Troubleshooting

- Se `npm test`/`npm run dev` falhar com erros de engine: verifique se voce esta usando Node.js 20+.
- Se aparecer `failed to get cargo metadata: program not found`, verifique se Rust esta instalado e se `%USERPROFILE%\.cargo\bin` esta no `PATH`.
- Se aparecer `'npm' nao e reconhecido` no `beforeDevCommand` do Tauri, confirme que o config usa `node ./node_modules/...` em `src-tauri/tauri.conf.json`.
- No Windows, garanta estes caminhos no `PATH` do usuario:
  - `C:\Windows\System32`
  - `C:\Windows`
  - `C:\Windows\System32\Wbem`
  - `C:\Windows\System32\WindowsPowerShell\v1.0\`
  - `%USERPROFILE%\.cargo\bin`
- Evite fixar dependencias de plataforma Linux (ex.: `@rollup/rollup-linux-x64-gnu`) em `devDependencies`; isso quebra `npm install` no Windows.

## Roadmap v2.0

Consulte o documento [docs/roadmap/versao2.md](./docs/roadmap/versao2.md) para ver as funcionalidades planejadas para a proxima versao:

- **Relatorios e Exportacao** - Excel (SheetJS) e PDF (@react-pdf/renderer)
- **Modelos de Documentos** - Geracao de DOCX com templates (docxtemplater)
- **Integracao com Tribunais** - Consulta automatica via API DataJud (CNJ)
- **Agenda e Compromissos** - Reunioes, audiencias e integracao Google Calendar
- **Controle Financeiro** - Honorarios, despesas e relatorios

## Licenca

MIT

## Contribuicao

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudancas (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request
