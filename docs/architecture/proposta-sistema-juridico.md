# JurisDesk â€” Sistema de Assistente JurÃ­dico

> Sistema desktop para escritÃ³rio de advocacia com banco local, gestÃ£o de clientes/documentos, controle de prazos e assistente IA.
>
> Status (16/02/2026): este arquivo Ã© uma referÃªncia arquitetural/propositiva. Para o estado implementado atual, valide tambÃ©m `README.md` e o cÃ³digo-fonte.

---

## Stack TÃ©cnica

| Camada | Tecnologia |
|--------|------------|
| Runtime | Tauri 2 (Rust) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS 4.x (tokens em `src/index.css`) |
| Estado | Zustand |
| Banco | SQLite (plugin tauri-plugin-sql) |
| PDF | pdfjs-dist |
| IA | Ollama (local) / Claude API / OpenAI API / Google Gemini API |
| NotificaÃ§Ãµes | tauri-plugin-notification |
| Tipografia | Inter (UI) + Lora (documentos) + JetBrains Mono (dados) |

---

## Estrutura do Projeto

```
jurisdesk/
â”œâ”€â”€ src-tauri/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ main.rs
â”‚   â”‚   â””â”€â”€ lib.rs
â”‚   â”œâ”€â”€ Cargo.toml
â”‚   â”œâ”€â”€ tauri.conf.json
â”‚   â””â”€â”€ capabilities/
â”‚       â””â”€â”€ default.json
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ layout/
â”‚   â”‚   â”‚   â”œâ”€â”€ Sidebar.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Header.tsx
â”‚   â”‚   â”‚   â””â”€â”€ MainLayout.tsx
â”‚   â”‚   â”œâ”€â”€ assistant/
â”‚   â”‚   â”‚   â”œâ”€â”€ ThinkingBlock.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ WebSearchResults.tsx
â”‚   â”‚   â”‚   â””â”€â”€ MessageCost.tsx
â”‚   â”‚   â”œâ”€â”€ cases/
â”‚   â”‚   â”‚   â””â”€â”€ CaseForm.tsx
â”‚   â”‚   â”œâ”€â”€ clients/
â”‚   â”‚   â”‚   â”œâ”€â”€ ClientForm.tsx
â”‚   â”‚   â”œâ”€â”€ dashboard/
â”‚   â”‚   â”‚   â””â”€â”€ DashboardSkeleton.tsx
â”‚   â”‚   â”œâ”€â”€ documents/
â”‚   â”‚   â”‚   â”œâ”€â”€ FolderTree.tsx
â”‚   â”‚   â”‚   â””â”€â”€ PDFViewer.tsx
â”‚   â”‚   â”œâ”€â”€ deadlines/
â”‚   â”‚   â”‚   â”œâ”€â”€ CalendarGrid.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ CalendarDay.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ CalendarDeadline.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ DeadlineForm.tsx
â”‚   â”‚   â”‚   â””â”€â”€ DayDetailPopover.tsx
â”‚   â”‚   â”œâ”€â”€ settings/
â”‚   â”‚   â”‚   â””â”€â”€ BackupSettings.tsx
â”‚   â”‚   â””â”€â”€ ui/
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ db.ts
â”‚   â”‚   â”œâ”€â”€ ai.ts
â”‚   â”‚   â”œâ”€â”€ pdf.ts
â”‚   â”‚   â”œâ”€â”€ extractors.ts
â”‚   â”‚   â”œâ”€â”€ autoBackup.ts
â”‚   â”‚   â”œâ”€â”€ activityLogger.ts
â”‚   â”‚   â”œâ”€â”€ globalSearch.ts
â”‚   â”‚   â”œâ”€â”€ documentStorage.ts
â”‚   â”‚   â”œâ”€â”€ attachmentCleanup.ts
â”‚   â”‚   â””â”€â”€ notifications.ts
â”‚   â”œâ”€â”€ stores/
â”‚   â”‚   â”œâ”€â”€ clientStore.ts
â”‚   â”‚   â”œâ”€â”€ caseStore.ts
â”‚   â”‚   â”œâ”€â”€ documentStore.ts
â”‚   â”‚   â”œâ”€â”€ deadlineStore.ts
â”‚   â”‚   â”œâ”€â”€ folderStore.ts
â”‚   â”‚   â”œâ”€â”€ chatStore.ts
â”‚   â”‚   â”œâ”€â”€ searchStore.ts
â”‚   â”‚   â””â”€â”€ settingsStore.ts
â”‚   â”œâ”€â”€ pages/
â”‚   â”‚   â”œâ”€â”€ Dashboard.tsx
â”‚   â”‚   â”œâ”€â”€ Clients.tsx
â”‚   â”‚   â”œâ”€â”€ Documents.tsx
â”‚   â”‚   â”œâ”€â”€ Calendar.tsx
â”‚   â”‚   â”œâ”€â”€ Assistant.tsx
â”‚   â”‚   â”œâ”€â”€ ActivityHistory.tsx
â”‚   â”‚   â””â”€â”€ Settings.tsx
â”‚   â”œâ”€â”€ test/
â”‚   â”‚   â””â”€â”€ setup.ts
â”‚   â”œâ”€â”€ types/
â”‚   â”‚   â””â”€â”€ index.ts
â”‚   â”œâ”€â”€ App.tsx
â”‚   â””â”€â”€ main.tsx
â”œâ”€â”€ package.json
â””â”€â”€ tailwind.config.js
```

---

## Schema do Banco (SQLite)

```sql
-- Clientes
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cpf_cnpj TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Casos/Processos
CREATE TABLE cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  case_number TEXT,
  court TEXT,
  type TEXT,
  status TEXT DEFAULT 'ativo',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Documentos
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  extracted_text TEXT,
  folder TEXT DEFAULT 'geral', -- legado
  folder_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Pastas de documentos
CREATE TABLE document_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  case_id INTEGER,
  client_id INTEGER,
  position INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES document_folders(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Prazos
CREATE TABLE deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  client_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATETIME NOT NULL,
  reminder_date DATETIME,
  completed INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'normal',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- Conversas IA
CREATE TABLE chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  title TEXT,
  provider TEXT DEFAULT 'ollama',  -- 'ollama' | 'claude' | 'openai'
  model TEXT,                       -- modelo usado na sessÃ£o (persistido)      
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
);

-- Mensagens do Chat
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  thinking_content TEXT,
  web_search_results TEXT,
  cost_usd REAL,
  intent_profile TEXT,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Anexos de chat
CREATE TABLE chat_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT NOT NULL,
  extracted_text TEXT,
  size_bytes INTEGER DEFAULT 0,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Configuracoes
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Logs de atividade
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  entity_name TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Logs de uso da IA
CREATE TABLE ai_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  thinking_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL
);
```

---

## Seguranca de Dados (fevereiro/2026)

### Segredos de IA
- Chaves `claude_api_key`, `openai_api_key` e `gemini_api_key` sao persistidas no keychain do sistema operacional (bridge Tauri + crate `keyring`).
- A tabela `settings` nao guarda mais segredo em texto puro (valor persistido como `null` para chaves sensiveis).
- Existe migracao automatica de chaves legadas em plaintext para keychain durante `fetchSettings()`.
- `exportDatabase()` exclui chaves sensiveis e `importDatabase()` ignora qualquer tentativa de reintroduzi-las.

### Integridade de arquivos locais
- `documents.file_path` e `chat_attachments.file_path` importados de backup passam por sanitizacao de escopo:
  - Documentos: somente paths dentro de `$APPDATA/documents`.
  - Anexos: somente paths dentro de `$APPDATA/chat_attachments`.
- Exclusoes em runtime validam o root gerenciado antes de remover arquivos no filesystem.
- Caminho configurado para auto backup e nome de arquivo de restore sao validados contra path traversal.
- Capability de filesystem no Tauri foi reduzida para escopo `$APPDATA` apenas.

### Backup e restore
- Auto backup usa envelope criptografado (`jurisdesk-backup-encrypted` v2):
  - KDF: PBKDF2 SHA-256 (`250_000` iteracoes)
  - Cifra: AES-GCM 256
- Restore mantem compatibilidade com backups legados JSON sem criptografia.
- `importDatabase()` reconstrui `documents_fts` ao final para evitar inconsistencias de busca apos restore/import completo.

---

## Funcionalidades Principais

### 1. GestÃ£o de Clientes
- Cadastro com dados bÃ¡sicos (nome, CPF/CNPJ, contato)
- Listagem com busca e filtros
- VisualizaÃ§Ã£o de casos e documentos vinculados

### 2. GestÃ£o de Documentos
- Upload de PDFs e outros arquivos
- OrganizaÃ§Ã£o em pastas por cliente/caso
- ExtraÃ§Ã£o automÃ¡tica de texto (PDFs) para contexto IA
- Visualizador integrado

### 3. Controle de Prazos
- CalendÃ¡rio visual de compromissos
- Cadastro de prazos com prioridade
- NotificaÃ§Ã£o nativa na vÃ©spera (via Tauri)
- Checklist de prazos pendentes no dashboard

### 4. Assistente IA
- Suporte a Ollama (local), Claude API, OpenAI API e Google Gemini API
- DetecÃ§Ã£o automÃ¡tica de modelos Ollama instalados
- PersistÃªncia do modelo escolhido por sessÃ£o de chat
- Chat contextualizado por caso
- Anexar arquivos (PDF/CSV/Excel/Word/TXT) para anÃ¡lise
- GeraÃ§Ã£o de peÃ§as jurÃ­dicas
- HistÃ³rico de conversas salvo localmente

---

## Design System

### Filosofia Visual (Professional & High Density)
- **Zero Gradientes:** SuperfÃ­cies sÃ³lidas e opacas para mÃ¡xima legibilidade.
- **Zero "Glassmorphism":** Evitar desfoques que dificultam a leitura de textos densos.
- **Bordas sobre Sombras:** Usar bordas sutis (`1px solid`) para definir hierarquia em vez de sombras difusas.
- **Densidade:** Interface otimizada para Desktop, permitindo visualizaÃ§Ã£o de mÃºltiplas informaÃ§Ãµes sem scroll excessivo.

### Paleta de Cores (Strict Neutral)
Baseada em tons de Zinc para eliminar saturaÃ§Ã£o desnecessÃ¡ria no background.

```css
:root {
  /* Backgrounds - SÃ³lidos e Neutros */
  --bg-app: #09090b;          /* zinc-950 (Fundo Geral) */
  --bg-panel: #18181b;        /* zinc-900 (Sidebars/Paineis) */
  --bg-surface: #27272a;      /* zinc-800 (Cards/Inputs) */
  
  /* Borders - DefiniÃ§Ã£o de Estrutura */
  --border-subtle: #27272a;   /* zinc-800 */
  --border-strong: #3f3f46;   /* zinc-700 */
  
  /* Text - Alto Contraste */
  --text-primary: #f4f4f5;    /* zinc-100 */
  --text-secondary: #a1a1aa;  /* zinc-400 */
  --text-muted: #71717a;      /* zinc-500 */
  
  /* Interactive / Accents */
  /* Azul apenas para aÃ§Ãµes primÃ¡rias e estados de foco */
  --brand-primary: #2563eb;   /* blue-600 */
  --brand-hover: #1d4ed8;     /* blue-700 */
  
  /* Semantic */
  --error: #ef4444;           /* red-500 */
  --success: #10b981;         /* emerald-500 */
  --warning: #f59e0b;         /* amber-500 */
}
```

### Tipografia

A tipografia Ã© a ferramenta mais importante de um sistema jurÃ­dico.

```css
/* UI Geral (Interface) */
font-family: 'Inter', system-ui, sans-serif;

/* Leitura de Documentos (PeÃ§as/Contratos) */
/* Remete Ã  formalidade do papel e facilita leitura longa */
font-family: 'Lora', serif;

/* Dados TÃ©cnicos (NÃºmeros de Processo, CNPJ, Datas) */
font-family: 'JetBrains Mono', monospace;
```

**Escala:**
- **H1:** 24px (Bold) - TÃ­tulos de SeÃ§Ã£o
- **H2:** 18px (SemiBold) - SubtÃ­tulos
- **Body:** 14px (Regular) - Interface Geral (Denso)
- **DocText:** 16px (Regular) - Leitura de PDFs/PeÃ§as (ConfortÃ¡vel)
- **Small:** 12px (Medium) - Metadados/Legendas

### Componentes Base

- **Cards & Paineis:** `rounded-md` (6px) ou `rounded-sm` (4px). Evitar `rounded-xl` para nÃ£o parecer "mobile app".
- **Inputs:** Fundo `zinc-900`, Borda `zinc-700`. Foco com `ring-1 ring-blue-600` (sem glow excessivo).
- **BotÃµes:**
  - *Primary:* Fundo Azul SÃ³lido, Texto Branco, Sem degradÃª.
  - *Secondary:* Borda `zinc-700`, Fundo Transparente, Hover `zinc-800`.
- **Tabelas (Data Grid):**
  - Linhas compactas (h-10).
  - Fontes monoespaÃ§adas para colunas numÃ©ricas/identificadores.
  - Zebrado sutil ou apenas linhas divisÃ³rias finas (`border-b border-zinc-800`).

---

## Fluxos Principais

### Upload de Documento + Contexto IA
```
1. UsuÃ¡rio seleciona PDF
2. Sistema salva arquivo em pasta local do cliente (appData/documents/<clientId>)
3. Extração roda em Web Worker (fallback para main thread se necessário)
4. Texto salvo em documents.extracted_text
5. No chat, usuÃ¡rio pode selecionar documentos como contexto
6. Prompt montado: system + contexto + histÃ³rico + mensagem
7. Resposta da API exibida e salva em chat_messages
```

### NotificaÃ§Ã£o de Prazo
```
1. Ao iniciar app, query busca prazos com reminder_date = hoje
2. Para cada prazo, dispara notificaÃ§Ã£o nativa via Tauri
3. Badge no Ã­cone de prazos indica pendÃªncias
4. Dashboard exibe lista de prazos prÃ³ximos
```

---

## DependÃªncias Principais

> Nota: as versÃµes abaixo sÃ£o ilustrativas. Para versÃµes efetivamente instaladas, consulte `package.json`.

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-notification": "^2.0.0",
    "@tauri-apps/plugin-sql": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
    "zustand": "^4.5.0",
    "pdfjs-dist": "^4.4.0",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.400.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.4.0"
  }
}
```

---

## ConfiguraÃ§Ã£o IA

```typescript
// lib/ai.ts

type AIProvider = 'ollama' | 'claude' | 'openai' | 'gemini';

interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;        // NÃ£o necessÃ¡rio para Ollama
  baseUrl?: string;       // Ollama: http://localhost:11434
}

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

// Detectar modelos Ollama instalados
async function getOllamaModels(baseUrl: string = 'http://localhost:11434'): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    const data = await response.json();
    return data.models || [];
  } catch {
    return []; // Ollama nÃ£o estÃ¡ rodando
  }
}

// Verificar se Ollama estÃ¡ disponÃ­vel
async function isOllamaRunning(baseUrl: string = 'http://localhost:11434'): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

// Models recomendados por provider:
// Ollama: llama3.1, mistral, codellama, qwen2.5 (detectados automaticamente)
// Claude: claude-sonnet-4-5-20250929
// OpenAI: gpt-5-mini
// Gemini: models/gemini-3-pro-preview, models/gemini-3-flash-preview
// Gemini testAPIConnection: chave enviada por header x-goog-api-key

// System prompt base para contexto jurÃ­dico
const SYSTEM_PROMPT = `VocÃª Ã© um assistente jurÃ­dico especializado no direito brasileiro.
Auxilie na anÃ¡lise de casos, elaboraÃ§Ã£o de peÃ§as processuais e pesquisa jurisprudencial.
Seja preciso nas citaÃ§Ãµes legais e mantenha linguagem tÃ©cnica apropriada.
Quando relevante, cite artigos de lei, sÃºmulas e jurisprudÃªncia.`;
```

### PersistÃªncia do Modelo por SessÃ£o

O modelo selecionado Ã© salvo na sessÃ£o de chat para garantir consistÃªncia durante toda a conversa:

```typescript
// stores/chatStore.ts

interface ChatSession {
  id: number;
  case_id?: number;
  title: string;
  provider: AIProvider;    // Persistido na sessÃ£o
  model: string;           // Persistido na sessÃ£o
  created_at: string;
}

interface ChatStore {
  activeSession: ChatSession | null;
  // ...

  // Ao criar sessÃ£o, salva provider/model escolhido
  createSession: (caseId?: number, provider: AIProvider, model: string) => Promise<ChatSession>;

  // Ao carregar sessÃ£o existente, usa provider/model salvos
  loadSession: (sessionId: number) => Promise<void>;
}
```

```sql
-- AtualizaÃ§Ã£o da tabela chat_sessions para persistir modelo
ALTER TABLE chat_sessions ADD COLUMN provider TEXT DEFAULT 'ollama';
ALTER TABLE chat_sessions ADD COLUMN model TEXT;
```

### Fluxo de SeleÃ§Ã£o de Modelo

```
1. Ao abrir Assistant, verifica se Ollama estÃ¡ rodando
2. Se sim, lista modelos instalados (GET /api/tags)
3. UsuÃ¡rio seleciona provider (Ollama/Claude/OpenAI/Gemini) e modelo
4. Ao iniciar nova sessÃ£o, provider+model sÃ£o salvos em chat_sessions
5. Durante a sessÃ£o, todas as mensagens usam o modelo salvo
6. Ao reabrir sessÃ£o existente, carrega provider+model do banco
7. UsuÃ¡rio pode trocar modelo apenas criando nova sessÃ£o
```

### Chamada Unificada por Provider

```typescript
// lib/ai.ts

async function sendMessage(
  session: ChatSession,
  messages: Message[],
  context?: string
): Promise<string> {
  const systemPrompt = context
    ? `${SYSTEM_PROMPT}\n\nContexto dos documentos:\n${context}`
    : SYSTEM_PROMPT;

  switch (session.provider) {
    case 'ollama':
      return sendToOllama(session.model, systemPrompt, messages);
    case 'claude':
      return sendToClaude(session.model, systemPrompt, messages);
    case 'openai':
      return sendToOpenAI(session.model, systemPrompt, messages);
  }
}

async function sendToOllama(
  model: string,
  systemPrompt: string,
  messages: Message[]
): Promise<string> {
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      stream: false
    })
  });
  const data = await response.json();
  return data.message.content;
}
```

---

## Comandos de InicializaÃ§Ã£o

```bash
# Criar projeto
npm create tauri-app@latest jurisdesk -- --template react-ts

# Instalar plugins Tauri
cargo add tauri-plugin-sql tauri-plugin-notification tauri-plugin-fs

# Instalar dependÃªncias frontend
npm install zustand pdfjs-dist date-fns lucide-react clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer

# Rodar em desenvolvimento
npm run tauri dev

# Build para produÃ§Ã£o
npm run tauri build
```

---

## Status de ImplementaÃ§Ã£o (fevereiro/2026)

1. [x] Base Tauri 2 + React/TypeScript inicializada
2. [x] Banco SQLite com schema principal e migraÃ§Ãµes em runtime
3. [x] CRUD de clientes, casos, documentos e prazos
4. [x] Assistente IA com Ollama, Claude, OpenAI e Gemini
5. [x] Upload e extraÃ§Ã£o de texto multi-formato
6. [x] Backup/restore (manual e automÃ¡tico) com validaÃ§Ãµes de seguranÃ§a
7. [x] NotificaÃ§Ãµes nativas e limpeza de anexos Ã³rfÃ£os
8. [x] Intervalo minimo entre backups completos para reduzir custo de I/O
9. [x] Virtualizacao da lista de mensagens do assistente + janela de memoria (100)
10. [x] Coordenador de limpeza em cascata (delecao de cliente/caso entre stores)
11. [x] Rollback de upload no cadastro de cliente para evitar arquivos orfaos
12. [x] API keys migradas para keychain do SO (sem segredo em plaintext no SQLite)
13. [x] Backup automatico criptografado com senha + compatibilidade legado
14. [x] Sanitizacao de `file_path` importado e validacao de delecao por root gerenciado
15. [x] Rebuild de `documents_fts` apos import completo
16. [x] Persistencia de custo/uso para Claude, GPT-5 e Gemini em `ai_usage_logs`
17. [x] Build Tauri endurecido: sem feature `devtools` na dependencia e escopo FS AppData-only
18. [ ] Evoluir cobertura de testes E2E e consolidar checklist de release
19. [ ] Refinamentos continuos de UX e roadmap v2

---

*Documento gerado como referÃªncia de arquitetura. Adapte conforme necessidade.*

