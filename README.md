# JurisDesk

Sistema desktop para escritorio de advocacia com banco de dados local, gestao de clientes/documentos, controle de prazos e assistente IA.

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
- [Atualizacoes Recentes](#atualizacoes-recentes)
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
- Limiar minimo de 2 caracteres para reduzir consultas pesadas sem ganho
- Navegacao por resultado com deep-link para entidade (`/clients?id=...`, `/documents?id=...`, `/calendar?id=...`)

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
- Backups automaticos criptografados com senha (AES-GCM + PBKDF2)
- Pasta de backup configuravel com validacao de escopo (somente AppData)
- Rotacao automatica (mantem ultimos N backups)
- Restauracao com senha e validacao de arquivo
- Compatibilidade de leitura com backups legados em JSON (sem criptografia)
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
- **CSP local para IA**: `connect-src` permite `localhost/127.0.0.1` em portas dinamicas para Ollama configuravel
- **Segredos no keychain**: API keys de IA ficam no cofre do sistema operacional, nao em texto puro no SQLite
- **Export/import seguro**: `exportDatabase()` exclui chaves sensiveis e `importDatabase()` ignora essas chaves
- **Path validation**: Caminhos de backup sao validados contra path traversal (somente AppData permitido)
- **Escopo de arquivos gerenciados**: delecao de documentos/anexos e paths importados sao aceitos apenas dentro dos roots do app
- **Backup criptografado**: fluxo de auto backup usa envelope criptografado com senha
- **Panic handling**: Hook de panic em Rust para logging antes de encerrar
- **Race condition fix**: Criacao de pastas de cliente com lock atomico
- **JSON validation**: Parse de web search results com validacao de schema
- **Desacoplamento**: Callback pattern entre stores para evitar dependencias circulares
- **Least privilege no Tauri**: plugin/permissao `shell` removidos; escopo FS reduzido para AppData
- **Hardening de build**: dependencia `tauri` sem feature `devtools` em release

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
- **Deduplicacao de fetch inicial**: stores ignoram requests paralelos duplicados (`fetch* in-flight`)
- **Busca robusta**: protecao contra respostas stale no Search (race condition entre digitacoes)
- **Indices SQLite adicionais**: aceleracao para consultas frequentes de clientes/casos/documentos/prazos

## Atualizacoes Recentes

### 20/02/2026 - Hardening tecnico, seguranca de dados e consistencia

- **Ollama configuravel ponta a ponta**: URL salva em `settings.ollama_url` passou a ser usada na verificacao de conexao, listagem de modelos e envio de mensagens.
- **Seguranca Tauri**: remocao do plugin `tauri-plugin-shell` e da permissao `shell:allow-open`.
- **CSP ajustada**: suporte a portas locais dinamicas (`localhost:*` e `127.0.0.1:*`) para execucoes de Ollama fora da porta padrao.
- **Datas locais consistentes**: pontos criticos (notificacoes/filtros/historico) migrados para chave de data local (`YYYY-MM-DD`) sem dependencia de UTC.
- **Busca global mais estavel**: limite minimo de consulta e protecao contra resultados fora de ordem durante digitacao rapida.
- **Persistencia/indices**: limpeza de FTS ao deletar documento e novos indices para consultas frequentes.
- **Navegacao por resultados**: paginas de Clientes/Documentos/Agenda consomem query params para abrir item diretamente.
- **API keys no keychain**: segredos migrados para armazenamento seguro do SO; DB deixa de manter valores sensiveis em texto puro.
- **Backup mais seguro**: auto backup criptografado com senha; restore mantem compatibilidade com backup legado.
- **Import/export blindado**: configuracoes sensiveis nao entram no backup e paths de arquivos importados sao sanitizados.
- **Consistencia transacional**: salvamento em lote de configuracoes via `SAVEPOINT` para evitar estado parcial.
- **Assistente mais resiliente**: delecao de sessao primeiro no DB e limpeza de anexos depois.
- **Custos completos**: uso/custo de GPT-5 e Gemini agora persiste em `ai_usage_logs`.
- **Gemini teste de conexao**: chave enviada por header `x-goog-api-key` (nao por query string).
- **UX alinhada ao comportamento real**: removido "limite diario" que nao era enforcement no envio.

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
|-- components/               # Componentes React
|   |-- layout/               # Sidebar, Header, MainLayout, SearchBar
|   |-- assistant/            # ThinkingBlock, WebSearchResults, MessageCost
|   |-- cases/                # CaseForm
|   |-- clients/              # ClientForm
|   |-- dashboard/            # DashboardSkeleton
|   |-- deadlines/            # CalendarGrid, CalendarDay, CalendarDeadline, DeadlineForm
|   |-- documents/            # FolderTree, PDFViewer
|   |-- settings/             # BackupSettings
|   `-- ui/                   # Button, Input, Modal, Card, Badge...
|-- lib/                      # Utilitarios
|   |-- db.ts                 # Wrapper SQLite + backup/restore
|   |-- ai.ts                 # Integracao Claude/OpenAI/Ollama/Gemini
|   |-- pdf.ts                # Extracao de texto PDF
|   |-- extractors.ts         # Extracao multi-formato (PDF/CSV/Excel/Word/TXT)
|   |-- globalSearch.ts       # Busca unificada
|   |-- activityLogger.ts     # Log de atividades
|   |-- autoBackup.ts         # Sistema de backup automatico
|   |-- attachmentCleanup.ts  # Limpeza de anexos orfaos
|   |-- documentStorage.ts    # Armazenamento local de documentos
|   `-- notifications.ts      # Notificacoes nativas
|-- stores/                   # Estado global (Zustand)
|   |-- clientStore.ts
|   |-- caseStore.ts
|   |-- documentStore.ts
|   |-- deadlineStore.ts
|   |-- folderStore.ts
|   |-- searchStore.ts
|   |-- chatStore.ts
|   `-- settingsStore.ts
|-- pages/                    # Paginas
|   |-- Dashboard.tsx
|   |-- Clients.tsx
|   |-- Documents.tsx
|   |-- Calendar.tsx
|   |-- Assistant.tsx
|   |-- ActivityHistory.tsx
|   `-- Settings.tsx
|-- test/                     # Setup e cenarios de teste
`-- types/                    # Tipos TypeScript

src-tauri/
|-- src/main.rs               # Entry point Rust
|-- src/lib.rs                # Inicializacao de plugins Tauri
|-- Cargo.toml                # Deps Rust
|-- tauri.conf.json           # Config Tauri
`-- capabilities/             # Permissoes de plugins
    `-- default.json
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
| `chat_attachments` | Anexos do chat |
| `settings` | Configuracoes do sistema |
| `ai_usage_logs` | Consumo e custo por mensagem de IA |
| `activity_logs` | Historico de atividades |

Observacao: `documents.file_path` guarda o caminho local do arquivo em appData.

### Backup e Restore

```typescript
import { exportDatabase, importDatabase } from '@/lib/db'
import { executeBackup, restoreFromBackup } from '@/lib/autoBackup'

// Exportar backup JSON (portabilidade; chaves sensiveis sao excluidas)
const backup = await exportDatabase()
const json = JSON.stringify(backup, null, 2)

// Importar backup JSON (paths sensiveis sao sanitizados)
const backup = JSON.parse(jsonString)
await importDatabase(backup)

// Auto backup criptografado com senha
await executeBackup('senha-forte')
await restoreFromBackup('jurisdesk_auto_2026-02-20T10-00-00-000Z.json', 'senha-forte')
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

Observacoes:
- A URL do Ollama e configuravel em **Settings > Inteligencia Artificial** (`ollama_url`).
- A URL configurada e respeitada tanto no teste de conexao quanto no runtime do Assistente.

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
| Inteligencia Artificial | API keys (Claude/OpenAI/Gemini via keychain), URL Ollama, Provider/Modelo padrao, Thinking/Reasoning, Web Search |
| Notificacoes | Ativar/desativar, Prazos vencidos, Prazos proximos, Antecedencia |
| Banco de Dados | Backup manual, Importar backup, Exportar CSV, Backup automatico |

### Chaves de Configuracao (tabela settings)

```
lawyer_name          # Nome do advogado
lawyer_oab           # Registro OAB
ui_density           # Densidade da UI: normal | compact
ui_motion            # Movimento da UI: system | normal | reduced
claude_api_key       # Alias da chave Anthropic (valor efetivo no keychain)
openai_api_key       # Alias da chave OpenAI (valor efetivo no keychain)
gemini_api_key       # Alias da chave Gemini (valor efetivo no keychain)
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
auto_backup_debounce # Debounce entre mutacao e backup (default: 5000)
auto_backup_min_interval_ms # Intervalo minimo entre backups completos (default: 60000)
```

Observacao: para `claude_api_key`, `openai_api_key` e `gemini_api_key`, o valor efetivo fica no keychain do SO; no SQLite esses campos sao mantidos como `null`.

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
O `package.json` declara `engines.node: >=20.0.0`.

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
- **Componentes**: UI propria (Tailwind + componentes em `src/components/ui`)

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


