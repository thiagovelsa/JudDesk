# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Regras Obrigatórias

### 1. Testes
- **SEMPRE** criar testes para novas funções e componentes
- Rodar `npm test` após implementações para garantir que nada quebrou
- Arquivos de teste: `*.test.ts` ou `*.test.tsx` no mesmo diretório

### 2. Documentação
- **SEMPRE** atualizar o README.md após adicionar/modificar funcionalidades
- Manter CLAUDE.md sincronizado com mudanças de arquitetura
- Documentar novas configurações e fluxos

### 3. Pesquisa e Contexto
- **SEMPRE** pesquisar quando faltar contexto:
  - Usar `WebSearch` para informações atualizadas
  - Usar `Context7 MCP` para documentação de bibliotecas (resolve-library-id → get-library-docs)
  - Usar `WebFetch` para consultar documentação oficial
- Não assumir - verificar antes de implementar

### 4. Raciocínio Estruturado
- Usar `sequential-thinking` para problemas complexos:
  - Debugging difícil
  - Decisões de arquitetura
  - Implementações com múltiplas etapas interdependentes
  - Quando precisar validar hipóteses

### 5. Qualidade
- Não deixar código incompleto ou com TODO sem resolver
- Verificar se imports estão corretos
- Testar fluxos end-to-end quando possível

## Projeto

JurisDesk — Sistema desktop para escritório de advocacia com banco local, gestão de clientes/documentos, controle de prazos e assistente IA.

## Stack

- **Runtime**: Tauri 2 (Rust)
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS 4.x (tokens em `src/index.css`)
- **Estado**: Zustand
- **Banco**: SQLite (tauri-plugin-sql)
- **PDF**: pdfjs-dist
- **IA**: Ollama (local) / Claude API / OpenAI API / Google Gemini API
- **Virtualização**: react-window + react-virtualized-auto-sizer
- **Notificações**: tauri-plugin-notification

## Comandos

```bash
# Instalar plugins Tauri (no diretório src-tauri)
cargo add tauri-plugin-sql tauri-plugin-notification tauri-plugin-fs tauri-plugin-dialog

# Instalar dependências
npm install

# Desenvolvimento
npm run tauri dev

# Build produção
npm run tauri build

# Typecheck
npx tsc -p tsconfig.json --noEmit

# Testes (requer Node.js 20+)
npm test
```

## Requisitos de Runtime (IMPORTANTE)

- Para rodar `npm test` e o toolchain atual (Vite/Vitest/JSDOM/React Router), use Node.js 20+.

## Arquitetura

```
src/
├── components/          # Componentes React por feature
│   ├── layout/         # Sidebar, Header, MainLayout
│   ├── clients/        # ClientForm (com upload de documentos), ClientDetails
│   ├── dashboard/      # DashboardSkeleton (loading state)
│   ├── documents/      # DocumentUpload, FolderTree, PDFViewer
│   ├── deadlines/      # DeadlineForm, CalendarGrid, CalendarDay, CalendarDeadline
│   ├── settings/       # BackupSettings
│   └── assistant/      # ChatWindow, MessageBubble, ContextPanel
├── lib/                # Utilitários e abstrações
│   ├── db.ts          # Wrapper SQLite
│   ├── ai.ts          # Integração Ollama/Claude/OpenAI/Gemini
│   ├── pdf.ts         # Extração de texto PDF
│   ├── autoBackup.ts  # Sistema de backup automático
│   ├── activityLogger.ts # Log de atividades
│   ├── globalSearch.ts   # Busca global
│   └── notifications.ts
├── stores/            # Estado global Zustand
│   ├── clientStore.ts
│   ├── caseStore.ts
│   ├── documentStore.ts
│   ├── deadlineStore.ts
│   ├── folderStore.ts
│   ├── chatStore.ts
│   ├── searchStore.ts
│   └── settingsStore.ts
└── pages/             # Páginas principais
    ├── Dashboard.tsx
    ├── Clients.tsx
    ├── Documents.tsx
    ├── Calendar.tsx
    ├── Assistant.tsx
    ├── ActivityHistory.tsx
    └── Settings.tsx

src-tauri/
├── src/main.rs        # Entry point Rust
├── src/lib.rs         # Plugins initialization
├── Cargo.toml         # Deps Rust
├── tauri.conf.json    # Config Tauri
└── capabilities/
    └── default.json   # Permissões dos plugins
```

## Configuração Tauri

### Plugins Necessários (lib.rs)

```rust
// Todos os plugins devem ser inicializados em lib.rs
.plugin(tauri_plugin_sql::Builder::new().build())
.plugin(tauri_plugin_notification::init())
.plugin(tauri_plugin_fs::init())
.plugin(tauri_plugin_dialog::init())  // Para seleção de pasta de backup
```

### Permissões (capabilities/default.json)

```json
{
  "permissions": [
    "core:default",
    "shell:allow-open",
    "sql:default",
    "sql:allow-load",
    "sql:allow-execute",
    "sql:allow-select",
    "sql:allow-close",
    "notification:default",
    "fs:default",
    "fs:allow-read",
    "fs:allow-write",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "fs:allow-remove",
    "fs:allow-appdata-read-recursive",
    "fs:allow-appdata-write-recursive",
    {
      "identifier": "fs:scope",
      "allow": ["$APPDATA", "$APPDATA/**", "$DESKTOP", "$DOWNLOAD"]
    },
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save"
  ]
}
```

**Nota:** O escopo do filesystem é restrito a `$APPDATA`, `$DESKTOP` e `$DOWNLOAD` para prevenir path traversal.

### Content Security Policy (tauri.conf.json)

```json
{
  "security": {
    "csp": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:11434 https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com"
  }
}
```

**Nota:** `'unsafe-inline'` foi removido do `style-src` por segurança (prevenção de injeção CSS).

## Banco de Dados

SQLite local com tabelas: `clients`, `cases`, `documents`, `deadlines`, `chat_sessions`, `chat_messages`, `settings`. Schema completo em `docs/architecture/proposta-sistema-juridico.md`.

## Fluxos Principais

1. **Upload PDF**: Salva arquivo → extrai texto com pdfjs → armazena em `documents.extracted_text` → disponível como contexto para IA
2. **Chat IA**: Seleciona provider/model → cria sessão (persiste escolha) → monta prompt → envia para Ollama/Claude/OpenAI → salva em `chat_messages`
3. **Notificações**: Query prazos com `reminder_date = hoje` ao iniciar → dispara notificação nativa Tauri
4. **Backup Automático**: Debounce de 5s após CRUD → exporta JSON → salva em pasta configurável → rotação automática (mantém últimos N)
5. **Calendário Visual**: Grid mensal com navegação → drag-and-drop para reagendar prazos → cores de prioridade
6. **Anexos de Clientes**: Documentos podem ser anexados diretamente no cadastro do cliente → gerenciados no painel de detalhes → usa documentStore existente com FK client_id

## Inicialização e Estado (Zustand)

### Carregamento Centralizado (App.tsx)

Todos os stores são carregados na inicialização do app para garantir dados disponíveis em qualquer página:

```typescript
// App.tsx - useEffect de inicialização
fetchSettings()   // Configurações (nome advogado, API keys, etc)
fetchClients()    // Lista de clientes
fetchCases()      // Lista de casos
fetchDocuments()  // Lista de documentos
fetchFolders()    // Árvore de pastas
fetchSessions()   // Sessões de chat
fetchDeadlines()  // Prazos (+ verificação de notificações)
```

### Reatividade em Tempo Real

Os stores do Zustand são **reativos** - alterações refletem imediatamente em todas as páginas:

| Operação | Comportamento | Propagação |
|----------|---------------|------------|
| **Criar** | Adiciona ao array local | Instantânea |
| **Editar** | Atualiza item ou refetch | Instantânea |
| **Deletar** | Remove do array local | Instantânea |

**Exemplo**: Criar cliente em `/clients` → Dashboard atualiza contador automaticamente

### Padrão dos Stores

```typescript
// Todas as operações CRUD devem:
// 1. Persistir no SQLite (executeInsert/Update/Delete)
// 2. Atualizar estado local (set())
// 3. Logar atividade (logActivity)
// 4. Disparar backup (triggerBackup)
```

## UI/UX (Tokens e Densidade)

- Tokens de tema e densidade vivem em `src/index.css` (ex: `--color-*`, `--space-*`, `--table-cell-*`).
- A densidade da UI é aplicada via `html[data-density='compact']` e persistida em `settings.ui_density`.
- Evitar: `rounded-xl`, `shadow-2xl`, glassmorphism/glow em telas densas.

### Loading States por Store

Cada store expõe estados de loading para operações assíncronas:

| Store | Loading States | Descrição |
|-------|----------------|-----------|
| **clientStore** | `loading` | Operações CRUD de clientes |
| **caseStore** | `loading` | Operações CRUD de casos |
| **documentStore** | `loading` | Operações CRUD de documentos |
| **deadlineStore** | `loading` | Operações CRUD de prazos |
| **folderStore** | `loading` | Todas operações de pastas |
| **chatStore** | `isLoading` | Envio de mensagens (send) |
| | `loadingSessions` | Carregamento de sessões |
| | `creatingSession` | Criação de nova sessão |
| | `loadingSession` | Carregamento de sessão específica |
| | `deletingSession` | Exclusão de sessão |
| | `messagesPagination.isLoadingMore` | Scroll infinito de mensagens |
| **settingsStore** | `loading` | Carregamento de configurações |
| | `saving` | Salvamento de configuração individual |

```typescript
// Uso em componentes
const { loading } = useClientStore()
const { isLoading, loadingSessions, creatingSession } = useChatStore()
const { saving } = useSettingsStore()

// Exemplo: desabilitar botão durante operação
<button disabled={saving}>Salvar</button>
```

### Persistência (IMPORTANTE)

**Persistência Pessimista**: Sempre salvar no banco ANTES de atualizar o UI:

```typescript
// ❌ ERRADO - Otimista: UI atualiza antes do banco (dados podem ser perdidos)
const userMessage = { id: Date.now(), content }  // ID temporário!
set((state) => ({ messages: [...state.messages, userMessage] }))
await executeInsert(/* ... */)  // Se falhar, mensagem "fantasma" no UI

// ✅ CORRETO - Pessimista: Banco primeiro, UI depois
const messageId = await executeInsert(/* ... */)  // ID real do banco
const userMessage = { id: messageId, content }
set((state) => ({ messages: [...state.messages, userMessage] }))
```

**Transações para Operações Críticas** (importDatabase):

```typescript
// Backup/restore usa transação para atomicidade
await database.execute('BEGIN TRANSACTION')
try {
  await database.execute('DELETE FROM ...')
  await database.execute('INSERT INTO ...')
  await database.execute('COMMIT')
} catch (error) {
  await database.execute('ROLLBACK')  // Restaura estado anterior
  throw error
}
```

**Conversão Segura de Boolean do SQLite**:

```typescript
// SQLite armazena boolean como INTEGER (0/1)
// Driver pode retornar como number OU string

// ❌ ERRADO - Boolean("0") === true (string não-vazia)
const completed = Boolean(row.completed)

// ✅ CORRETO - Função que trata todos os casos
function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return false
}
```

**Race Conditions em Criação**:

```typescript
// ❌ ERRADO - Check-then-create permite duplicatas
const existing = folders.find(f => f.client_id === clientId)
if (!existing) {
  await createFolder(/* ... */)  // Duas chamadas simultâneas criam 2 pastas
}

// ✅ CORRETO - INSERT OR IGNORE atômico no banco
await executeInsert(
  `INSERT OR IGNORE INTO document_folders (name, client_id, ...)
   SELECT ?, ?, ... WHERE NOT EXISTS (SELECT 1 FROM document_folders WHERE client_id = ?)`,
  [name, clientId, clientId]
)
```

### Seletores Reativos (IMPORTANTE)

**NUNCA** use métodos getter nos seletores do Zustand - eles não criam subscrições adequadas:

```typescript
// ❌ ERRADO - Não cria subscrição, componente não re-renderiza
const { getSetting } = useSettingsStore()
const value = getSetting('key')

// ❌ ERRADO - Método assíncrono, sem reatividade
const { getUpcomingDeadlines } = useDeadlineStore()
useEffect(() => {
  getUpcomingDeadlines(7).then(setData)
}, [])

// ✅ CORRETO - Seletor inline cria subscrição
const value = useSettingsStore((state) => state.settings['key'])

// ✅ CORRETO - Múltiplos seletores específicos (evita re-render desnecessário)
// Ao invés de: const settings = useSettingsStore((state) => state.settings)
const claudeApiKey = useSettingsStore((state) => state.settings['claude_api_key'])
const openaiApiKey = useSettingsStore((state) => state.settings['openai_api_key'])
const geminiApiKey = useSettingsStore((state) => state.settings['gemini_api_key'])

// ✅ CORRETO - Computar do state reativo com useMemo
const { deadlines } = useDeadlineStore()
const upcomingDeadlines = useMemo(() => {
  const today = new Date()
  const futureDate = new Date(today)
  futureDate.setDate(today.getDate() + 7)
  return deadlines.filter(d => !d.completed && new Date(d.due_date) <= futureDate)
}, [deadlines])
```

**Quando usar cada padrão:**

| Situação | Padrão |
|----------|--------|
| Valor para render/UI | `useStore((state) => state.property)` |
| Valor computado/filtrado | `useMemo(() => ..., [storeData])` |
| Valor em event handler | `useStore.getState().property` (ok não ser reativo) |
| Após fetch no useEffect | `useStore.getState().property` dentro do `.then()` |

**Métodos getter nos stores são para:**
- Uso interno do store
- Event handlers onde reatividade não é necessária
- **NÃO** para seletores que afetam render

## Sistema de Backup

```typescript
// Configurações em Settings (auto_backup_*)
// - enabled: ativar/desativar
// - path: pasta customizada (default: AppData/JurisDesk/backups)
// - max_count: número máximo de backups (rotação automática)
// - debounce: tempo de espera após operação CRUD (default: 5000ms)

// Uso: triggerBackup() é chamado automaticamente após operações CRUD nos stores
// Backup manual: executeBackup()
// Restauração: restoreFromBackup(filename)
```

## Calendário de Prazos

```typescript
// Visualizações: 'calendar' | 'list'
// Componentes: CalendarGrid > CalendarDay > CalendarDeadline > DayDetailPopover
// Drag-and-drop: @dnd-kit/core (mesmo padrão de FolderTree)

// Cores de prioridade:
// - baixa: gray-500
// - normal: blue-500
// - alta: amber-500
// - urgente: red-500

// Expansão de dia (DayDetailPopover):
// - Clicar no dia com obrigações abre popover animado
// - Clicar em "+X mais" também abre o popover
// - Mostra todas as obrigações (pendentes e concluídas separadamente)
// - Permite marcar como concluído, editar ou adicionar nova obrigação
// - Animação suave de entrada/saída (scale + fade + translate)
// - Fecha ao clicar fora, pressionar Escape ou no botão X
```

## Configuração IA

```typescript
// Providers suportados: 'ollama' | 'claude' | 'openai' | 'gemini'

// Models recomendados:
// Ollama: llama3.1, mistral, qwen2.5, codellama (detectados via GET /api/tags)
// Claude: claude-sonnet-4-5-20250929, claude-sonnet-4-20250514
// OpenAI: gpt-5-mini (usa Responses API com reasoning)
// Gemini: models/gemini-3-pro-preview, models/gemini-3-flash-preview

// Ollama endpoint: http://localhost:11434
// Detecção de modelos: GET /api/tags
// Chat: POST /api/chat

// Funcionalidades avançadas por provider:
// - Claude: Extended Thinking, Web Search, Caching
// - OpenAI/GPT-5: Reasoning (effort levels), Web Search
// - Gemini: Thinking Budget, Google Search Grounding

// AbortController: Todas as funções de AI suportam signal para cancelamento
// Uso: sendMessage(..., signal) ou sendMessageAdvanced(..., signal)

// Persistência: provider + model salvos em chat_sessions
// Garante consistência do modelo durante toda a sessão
```

## Upload de Arquivos no Chat

```typescript
// Limites de upload (Assistant.tsx)
const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10 MB por arquivo
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50 MB total
const MAX_FILE_COUNT = 5                 // Máximo 5 arquivos

// Formatos suportados: PDF, CSV, Excel (.xlsx/.xls), Word (.docx), TXT, Markdown
// Extração de texto via lib/extractors.ts
```

## Design

- Dark theme: Slate/Blue via tokens em `src/index.css` (evitar preto puro)
- Densidade: `settings.ui_density` aplica `html[data-density='compact']`
- Ícones: Lucide React (preferir `strokeWidth={1.5}` consistente)
- Componentes: UI própria em `src/components/ui` (Tailwind + tokens)

## Otimizações de Performance

### Virtualização de Listas (react-window)

Listas e grids com mais de 50-100 itens usam virtualização:

```typescript
// Documents.tsx, Clients.tsx - Grid virtualizado
import { FixedSizeGrid as Grid } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'

// Threshold para ativar virtualização
const VIRTUALIZATION_THRESHOLD = 50

// Uso condicional
{useVirtualization ? (
  <AutoSizer>
    {({ height, width }) => (
      <Grid
        columnCount={columnCount}
        columnWidth={columnWidth}
        height={height}
        rowCount={rowCount}
        rowHeight={CARD_HEIGHT}
        width={width}
      >
        {CellRenderer}
      </Grid>
    )}
  </AutoSizer>
) : (
  <div className="grid">{/* render normal */}</div>
)}

// ActivityHistory.tsx - Lista variável
import { VariableSizeList as List } from 'react-window'
```

### Lazy Loading de extracted_text

Documentos não carregam texto extraído por padrão (otimização de memória):

```typescript
// documentStore.ts
fetchDocuments: async () => {
  // Query retorna has_extracted_text (0/1) ao invés do texto completo
  const documents = await getDocumentsMetadata()
  set({ documents })
}

searchDocuments: async (query: string) => {
  // Busca no banco usa extracted_text, mas retorna apenas metadata
  const results = await executeQuery(
    `SELECT id, name, ...,
     CASE WHEN extracted_text IS NOT NULL THEN 1 ELSE 0 END as has_extracted_text
     FROM documents WHERE name LIKE ? OR extracted_text LIKE ?`
  )
  // Documentos marcados com '__LAZY_LOAD__' ao invés do texto real
  const documents = results.map(r => ({
    ...r,
    extracted_text: r.has_extracted_text ? '__LAZY_LOAD__' : null
  }))
}

getExtractedText: async (id: number) => {
  // Carrega texto sob demanda com cache (max 10 docs)
  const { extractedTextCache } = get()
  if (extractedTextCache.has(id)) return extractedTextCache.get(id)

  const text = await getDocumentExtractedText(id)
  // Cache com limite de tamanho (FIFO eviction)
  if (extractedTextCache.size > 10) {
    const firstKey = extractedTextCache.keys().next().value
    extractedTextCache.delete(firstKey)
  }
  extractedTextCache.set(id, text)
  return text
}
```

### Paginação de Mensagens do Chat

```typescript
// chatStore.ts
loadSession: async (sessionId, limit = 50) => {
  // Carrega últimas 50 mensagens
  const messages = await executeQuery(
    `SELECT * FROM chat_messages WHERE session_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [sessionId, limit]
  )
  set({ messages: messages.reverse(), messagesPagination: { hasMore: true, offset: limit } })
}

loadMoreMessages: async () => {
  // Scroll infinito para mensagens antigas
  const older = await executeQuery(/*...*/, [sessionId, 50, offset])
  set({ messages: [...older.reverse(), ...messages] })
}

// Contexto limitado para IA
const CONTEXT_LIMIT = 30
const recentMessages = messages.slice(-CONTEXT_LIMIT)
```

### Queries Otimizadas

```typescript
// caseStore.ts - Evita N+1
getAllCaseCounts: async () => {
  // Uma query ao invés de N queries
  const results = await executeQuery(
    `SELECT client_id, COUNT(*) as count FROM cases GROUP BY client_id`
  )
  return Object.fromEntries(results.map(r => [r.client_id, r.count]))
}
```

### Memoização

```typescript
// Usar useMemo para dados filtrados/derivados
const filteredDocuments = useMemo(
  () => documents.filter(d => d.folder_id === selectedFolderId),
  [documents, selectedFolderId]
)

// Usar useCallback para handlers passados como props
const handleSelectClient = useCallback((client) => {
  setSelectedClient(client)
}, [])

// Usar React.memo para componentes de lista
const ClientCard = memo(function ClientCard({ client, ...props }) {
  // ...
})
```

### Async Operations com isMounted

```typescript
// Evitar setState após unmount em operações assíncronas
const isMountedRef = useRef(true)

useEffect(() => {
  isMountedRef.current = true
  return () => {
    isMountedRef.current = false
  }
}, [])

const handleAsyncOperation = async () => {
  setLoading(true)
  try {
    const result = await fetchData()
    // Verificar antes de setState
    if (!isMountedRef.current) return
    setData(result)
  } finally {
    if (isMountedRef.current) {
      setLoading(false)
    }
  }
}
```

### IDs Únicos sem Date.now()

```typescript
// ❌ ERRADO - IDs podem colidir e não são estáveis
const id = Date.now() + Math.random()

// ✅ CORRETO - Contador incremental via useRef
const idCounterRef = useRef(0)
const getNextId = useCallback(() => ++idCounterRef.current, [])

// Uso
const newItem = { id: getNextId(), ... }
```

### Console.logs Condicionais

```typescript
// Em produção, não logar debug info
if (import.meta.env.DEV) {
  console.log('[Module] Debug info:', data)
}
```

## Testes

```bash
# Executar todos os testes
npm run test

# Executar com coverage
npm run test -- --coverage

# Executar arquivo específico
npm run test -- src/lib/autoBackup.test.ts
```

Arquivos de teste:
- `src/lib/*.test.ts` - Testes de utilitários (ai, pdf, notifications, autoBackup, etc)
- `src/stores/*.test.ts` - Testes de stores Zustand
- `src/components/**/*.test.tsx` - Testes de componentes React

Total: 595 testes | Cobertura: ~90% statements
