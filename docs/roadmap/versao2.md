# JurisDesk v2.0 - Roadmap de Evolucao

## Sumario Executivo

Este documento apresenta as melhorias propostas para a proxima versao do JurisDesk, com foco em funcionalidades que agregam valor real para advogados. Todas as sugestoes foram pesquisadas e validadas com bibliotecas e APIs que funcionam com nossa stack (Tauri 2 + React + TypeScript + SQLite).

**Stack atual:** Tauri 2 | React 18 | TypeScript | SQLite | Zustand

---

## 1. Relatorios e Exportacao

### Problema
Advogados precisam gerar documentos constantemente: relatorios de clientes, lista de prazos, historico de atividades. Atualmente o sistema nao oferece exportacao.

### Solucao Proposta

#### 1.1 Exportacao para Excel (XLSX)

**Biblioteca:** [SheetJS (xlsx)](https://docs.sheetjs.com/docs/demos/frontend/react/)
- 2.6M downloads/semana no npm
- Funciona no browser, sem servidor
- Suporta multiplas abas

**Instalacao:**
```bash
npm install xlsx file-saver
npm install -D @types/file-saver
```

**Implementacao:**
```typescript
// src/lib/exportExcel.ts
import { utils, writeFile } from 'xlsx'

export function exportClientsToExcel(clients: Client[]) {
  const data = clients.map(c => ({
    Nome: c.name,
    'CPF/CNPJ': c.cpf_cnpj,
    Email: c.email,
    Telefone: c.phone,
    'Data Cadastro': new Date(c.created_at).toLocaleDateString('pt-BR')
  }))

  const ws = utils.json_to_sheet(data)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Clientes')
  writeFile(wb, `clientes_${Date.now()}.xlsx`)
}
```

**Funcionalidades:**
- Exportar lista de clientes
- Exportar lista de casos por cliente
- Exportar prazos do mes
- Exportar historico de atividades

---

#### 1.2 Exportacao para PDF

**Biblioteca:** [@react-pdf/renderer](https://react-pdf.org/)
- 860K downloads/semana
- Abordagem React-first com JSX
- Suporta estilos CSS-like

**Alternativa:** [jsPDF](https://github.com/parallax/jsPDF) + html2canvas
- 2.6M downloads/semana
- Converte HTML diretamente para PDF
- Mais simples para relatorios basicos

**Instalacao:**
```bash
npm install @react-pdf/renderer
# OU para abordagem mais simples:
npm install jspdf html2canvas
```

**Implementacao com @react-pdf/renderer:**
```typescript
// src/components/reports/ClientReport.tsx
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 30 },
  title: { fontSize: 18, marginBottom: 20 },
  row: { flexDirection: 'row', borderBottom: '1px solid #ccc', padding: 5 }
})

export const ClientReportPDF = ({ clients }: { clients: Client[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Relatorio de Clientes</Text>
      {clients.map(client => (
        <View key={client.id} style={styles.row}>
          <Text>{client.name}</Text>
          <Text>{client.cpf_cnpj}</Text>
        </View>
      ))}
    </Page>
  </Document>
)

// Para gerar e baixar:
const blob = await pdf(<ClientReportPDF clients={clients} />).toBlob()
saveAs(blob, 'relatorio-clientes.pdf')
```

**Relatorios sugeridos:**
- Ficha completa do cliente (dados + casos + documentos)
- Agenda de prazos semanal/mensal
- Relatorio de produtividade (atividades por periodo)

---

## 2. Modelos de Documentos Juridicos

### Problema
Advogados redigem documentos repetitivos (procuracoes, contratos, peticoes). Criar do zero toda vez e improdutivo.

### Solucao Proposta

**Biblioteca:** [docxtemplater](https://docxtemplater.com/)
- 400K downloads/mes
- Usado por ~50.000 empresas
- Templates editaveis no Word
- Suporta loops, condicoes, imagens

**Instalacao:**
```bash
npm install docxtemplater pizzip file-saver
npm install -D @types/file-saver
```

**Implementacao:**
```typescript
// src/lib/documentTemplates.ts
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { saveAs } from 'file-saver'

export async function generateDocument(
  templatePath: string,
  data: Record<string, any>,
  outputName: string
) {
  // Carregar template
  const response = await fetch(templatePath)
  const templateBuffer = await response.arrayBuffer()

  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  })

  // Preencher dados
  doc.render(data)

  // Gerar arquivo
  const output = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })

  saveAs(output, outputName)
}

// Uso:
generateDocument('/templates/procuracao.docx', {
  cliente_nome: client.name,
  cliente_cpf: client.cpf_cnpj,
  advogado_nome: lawyerName,
  advogado_oab: lawyerOAB,
  data_extenso: formatDateExtended(new Date())
}, 'procuracao_joao_silva.docx')
```

**Templates sugeridos:**
| Template | Variaveis |
|----------|-----------|
| Procuracao Ad Judicia | cliente_nome, cliente_cpf, advogado_nome, advogado_oab, poderes |
| Contrato de Honorarios | cliente_nome, valor, forma_pagamento, objeto |
| Declaracao de Hipossuficiencia | cliente_nome, cliente_cpf, endereco |
| Substabelecimento | advogado_origem, advogado_destino, poderes |

**Estrutura de pastas:**
```
public/
└── templates/
    ├── procuracao.docx
    ├── contrato_honorarios.docx
    ├── declaracao_hipossuficiencia.docx
    └── substabelecimento.docx
```

**Nova pagina:** `src/pages/Templates.tsx`
- Lista de templates disponiveis
- Selecionar cliente para preencher automaticamente
- Preview antes de gerar
- Historico de documentos gerados

---

## 3. Integracao com Tribunais

### Problema
Advogados consultam processos manualmente nos sites dos tribunais. Falta integracao automatizada para acompanhamento.

### Solucao Proposta

**APIs Disponiveis:**

| Servico | Cobertura | Modelo | Custo |
|---------|-----------|--------|-------|
| [DataJud CNJ](https://datajud-wiki.cnj.jus.br/api-publica/) | Todos os tribunais brasileiros | API REST (Elasticsearch) | **Gratuita** |
| [Escavador](https://api.escavador.com/) | Tribunais + Diarios Oficiais | API REST | Creditos gratis iniciais |
| [INTIMA.AI](https://intima.ai/) | PJe, PROJUDI, e-SAJ, e-PROC | API REST | Paga por consulta |
| [Judit.io](https://judit.io/) | 90+ tribunais, 20 sistemas | API REST + SDK | Paga |

**Recomendacao:** Usar **API Publica do DataJud (CNJ)** - unica opcao 100% gratuita e oficial.

#### Detalhes da API DataJud (Gratuita)

**Autenticacao:**
- Requer API Key publica (disponivel em [datajud-wiki.cnj.jus.br/api-publica/acesso](https://datajud-wiki.cnj.jus.br/api-publica/acesso/))
- Header: `Authorization: APIKey [chave_publica]`

**Dados disponiveis:**
- Metadados de processos (capa processual)
- Movimentacoes processuais
- Tribunais: STF, STJ, TST, TRFs, TJs, TRTs, TREs, Justica Militar
- **Nao inclui:** processos em segredo de justica, documentos anexados

**Limites:**
- Ate 10.000 registros por pagina
- Sem limite diario documentado
- Dados podem ter atraso de 24-48h

**Documentacao oficial:**
- [Wiki DataJud](https://datajud-wiki.cnj.jus.br/api-publica/)
- [Tutorial PDF](https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf)

**Implementacao com DataJud:**
```typescript
// src/lib/datajud.ts
const DATAJUD_URL = 'https://api-publica.datajud.cnj.jus.br'

// API Key publica - obter em: https://datajud-wiki.cnj.jus.br/api-publica/acesso/
const DATAJUD_API_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='

interface ProcessoDatajud {
  numeroProcesso: string
  classe: { nome: string }
  orgaoJulgador: { nome: string }
  movimentos: Array<{ nome: string; dataHora: string }>
}

export async function consultarProcesso(
  numeroProcesso: string,
  tribunal: string
): Promise<ProcessoDatajud | null> {
  try {
    const response = await fetch(
      `${DATAJUD_URL}/api_publica_${tribunal}/_search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `APIKey ${DATAJUD_API_KEY}`
        },
        body: JSON.stringify({
          query: {
            match: { numeroProcesso: numeroProcesso.replace(/\D/g, '') }
          }
        })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data.hits?.hits?.[0]?._source || null
  } catch (error) {
    console.error('Erro ao consultar DataJud:', error)
    return null
  }
}
```

> **Nota:** A API Key publica esta disponivel na [Wiki do DataJud](https://datajud-wiki.cnj.jus.br/api-publica/acesso/). Ela e a mesma para todos os usuarios e pode ser atualizada periodicamente.

**Funcionalidades:**
- Campo "Numero do Processo" no cadastro de casos
- Botao "Consultar Tribunal" para buscar dados
- Importar movimentacoes automaticamente
- Alerta de novas movimentacoes (verificacao periodica)

**Limitacoes DataJud:**
- Dados podem ter atraso de 24-48h
- Apenas metadados (sem documentos)
- Para dados em tempo real, considerar INTIMA.AI ou Judit.io

---

## 4. Agenda e Compromissos

### Problema
O sistema tem apenas "Prazos" (processuais). Advogados tambem precisam gerenciar reunioes, audiencias e compromissos pessoais.

### Solucao Proposta

#### 4.1 Modulo de Agenda Local

**Mudancas no banco:**
```sql
-- Nova tabela
CREATE TABLE appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  location TEXT,
  type TEXT CHECK(type IN ('reuniao', 'audiencia', 'compromisso', 'outro')),
  client_id INTEGER REFERENCES clients(id),
  case_id INTEGER REFERENCES cases(id),
  reminder_minutes INTEGER DEFAULT 30,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Novo store:** `src/stores/appointmentStore.ts`

**Integracao com Calendar.tsx:**
- Exibir prazos (vermelho) e compromissos (azul) no mesmo calendario
- Filtro por tipo
- Criar compromisso com drag-and-drop

#### 4.2 Integracao Google Calendar (Opcional)

**Biblioteca:** [react-google-calendar-api](https://www.npmjs.com/package/react-google-calendar-api)

**Custo:** **Gratuito** - A Google Calendar API e 100% gratuita
- Limite: 1.000.000 queries/dia (mais que suficiente)
- Nao requer cartao de credito
- [Documentacao de cotas](https://developers.google.com/workspace/calendar/api/guides/quota)

**Pre-requisitos:**
1. Criar projeto no Google Cloud Console (gratuito)
2. Habilitar Google Calendar API
3. Configurar OAuth 2.0 credentials
4. Adicionar Client ID no .env

**Instalacao:**
```bash
npm install react-google-calendar-api
```

**Implementacao:**
```typescript
// src/lib/googleCalendar.ts
import ApiCalendar from 'react-google-calendar-api'

const config = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  scope: 'https://www.googleapis.com/auth/calendar',
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
}

const apiCalendar = new ApiCalendar(config)

export async function syncToGoogleCalendar(appointment: Appointment) {
  if (!apiCalendar.sign) {
    await apiCalendar.handleAuthClick()
  }

  return apiCalendar.createEvent({
    summary: appointment.title,
    description: appointment.description,
    start: { dateTime: appointment.start_date },
    end: { dateTime: appointment.end_date || appointment.start_date },
    location: appointment.location
  })
}
```

**Fluxo:**
1. Usuario conecta conta Google (uma vez)
2. Ao criar compromisso, opcao "Sincronizar com Google Calendar"
3. Sincronizacao bidirecional opcional

---

## 5. Controle Financeiro Basico

### Problema
Advogados precisam controlar honorarios recebidos e pendentes por cliente/caso.

### Solucao Proposta

**Mudancas no banco:**
```sql
-- Nova tabela
CREATE TABLE financial_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  case_id INTEGER REFERENCES cases(id),
  type TEXT CHECK(type IN ('honorario', 'despesa', 'reembolso')),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT,
  paid_date TEXT,
  status TEXT CHECK(status IN ('pendente', 'pago', 'cancelado')) DEFAULT 'pendente',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Novo store:** `src/stores/financialStore.ts`

**Nova pagina:** `src/pages/Financial.tsx`
- Dashboard com totais (recebido, pendente, atrasado)
- Lista de lancamentos com filtros
- Grafico de evolucao mensal

**Integracao com Clientes:**
- Adicionar aba "Financeiro" no painel de detalhes do cliente
- Mostrar saldo (total recebido / total pendente)

---

## 6. Ordem de Implementacao Sugerida

| Prioridade | Funcionalidade | Esforco | Dependencias |
|------------|----------------|---------|--------------|
| 1 | Exportacao Excel | 4h | SheetJS |
| 2 | Exportacao PDF | 6h | @react-pdf/renderer |
| 3 | Modelos de Documentos | 8h | docxtemplater |
| 4 | Agenda Local | 6h | Nova tabela |
| 5 | Consulta DataJud | 4h | API gratuita |
| 6 | Financeiro Basico | 8h | Nova tabela |
| 7 | Google Calendar | 6h | OAuth setup |

**Total estimado:** ~42h de desenvolvimento

---

## 7. Dependencias a Instalar

```bash
# Exportacao
npm install xlsx file-saver @react-pdf/renderer
npm install -D @types/file-saver

# Templates DOCX
npm install docxtemplater pizzip

# Google Calendar (opcional)
npm install react-google-calendar-api
```

**Tamanho estimado no bundle:**
- xlsx: ~300KB
- @react-pdf/renderer: ~400KB
- docxtemplater + pizzip: ~150KB
- react-google-calendar-api: ~50KB

---

## 8. Arquivos a Criar/Modificar

### Novos arquivos:
```
src/
├── lib/
│   ├── exportExcel.ts       # Funcoes de exportacao Excel
│   ├── exportPdf.ts         # Funcoes de exportacao PDF
│   ├── documentTemplates.ts # Geracao de DOCX
│   ├── datajud.ts           # Integracao DataJud
│   └── googleCalendar.ts    # Integracao Google (opcional)
├── stores/
│   ├── appointmentStore.ts  # CRUD de compromissos
│   └── financialStore.ts    # CRUD financeiro
├── pages/
│   ├── Templates.tsx        # Pagina de modelos
│   └── Financial.tsx        # Pagina financeira
└── components/
    └── reports/
        ├── ClientReport.tsx
        ├── DeadlineReport.tsx
        └── ActivityReport.tsx

public/
└── templates/
    ├── procuracao.docx
    ├── contrato_honorarios.docx
    └── declaracao_hipossuficiencia.docx
```

### Arquivos a modificar:
- `src/lib/db.ts` - Adicionar novas tabelas
- `src/pages/Calendar.tsx` - Integrar compromissos
- `src/pages/Clients.tsx` - Adicionar botoes de exportacao
- `src/components/layout/Sidebar.tsx` - Novos links de menu

---

## 10. Implementacao Detalhada: Backend e Frontend

Esta secao detalha como cada funcionalidade seria implementada no backend (Rust/Tauri/SQLite) e frontend (React/TypeScript/Zustand).

---

### 10.1 Relatorios e Exportacao

#### Backend (Tauri/Rust)

**Nao requer mudancas no Rust** - toda a logica de exportacao acontece no frontend usando bibliotecas JavaScript (SheetJS, @react-pdf/renderer).

**Tauri Dialog Plugin** (ja instalado) - para selecionar pasta de destino:
```rust
// Ja disponivel via tauri-plugin-dialog
// Usado para salvar arquivos em local escolhido pelo usuario
```

**Configuracao tauri.conf.json:**
```json
{
  "plugins": {
    "dialog": {
      "all": true
    }
  }
}
```

#### Frontend (React/TypeScript)

**Novo arquivo:** `src/lib/exportExcel.ts`
```typescript
import { utils, writeFile } from 'xlsx'
import type { Client, Case, Deadline } from '@/types'

// Exportar clientes
export function exportClientsToExcel(clients: Client[], filename?: string) {
  const data = clients.map(c => ({
    'Nome': c.name,
    'CPF/CNPJ': c.cpf_cnpj || '',
    'Email': c.email || '',
    'Telefone': c.phone || '',
    'Endereco': c.address || '',
    'Cadastrado em': new Date(c.created_at).toLocaleDateString('pt-BR')
  }))

  const ws = utils.json_to_sheet(data)

  // Ajustar largura das colunas
  ws['!cols'] = [
    { wch: 30 }, // Nome
    { wch: 18 }, // CPF/CNPJ
    { wch: 25 }, // Email
    { wch: 15 }, // Telefone
    { wch: 40 }, // Endereco
    { wch: 12 }, // Data
  ]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Clientes')
  writeFile(wb, filename || `clientes_${formatDateFile()}.xlsx`)
}

// Exportar casos
export function exportCasesToExcel(cases: Case[], clients: Client[]) {
  const clientMap = new Map(clients.map(c => [c.id, c.name]))

  const data = cases.map(c => ({
    'Numero': c.case_number,
    'Titulo': c.title,
    'Cliente': clientMap.get(c.client_id) || 'N/A',
    'Tribunal': c.court || '',
    'Tipo': c.case_type || '',
    'Status': c.status,
    'Criado em': new Date(c.created_at).toLocaleDateString('pt-BR')
  }))

  const ws = utils.json_to_sheet(data)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Casos')
  writeFile(wb, `casos_${formatDateFile()}.xlsx`)
}

// Exportar prazos
export function exportDeadlinesToExcel(deadlines: Deadline[], cases: Case[]) {
  const caseMap = new Map(cases.map(c => [c.id, c.title]))

  const data = deadlines.map(d => ({
    'Titulo': d.title,
    'Caso': d.case_id ? caseMap.get(d.case_id) || 'N/A' : 'Geral',
    'Vencimento': new Date(d.due_date).toLocaleDateString('pt-BR'),
    'Prioridade': d.priority,
    'Status': d.completed ? 'Concluido' : 'Pendente',
    'Descricao': d.description || ''
  }))

  const ws = utils.json_to_sheet(data)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Prazos')
  writeFile(wb, `prazos_${formatDateFile()}.xlsx`)
}

// Exportar relatorio completo (multiplas abas)
export function exportFullReport(
  clients: Client[],
  cases: Case[],
  deadlines: Deadline[]
) {
  const wb = utils.book_new()

  // Aba Clientes
  const clientsData = clients.map(c => ({
    'Nome': c.name,
    'CPF/CNPJ': c.cpf_cnpj || '',
    'Email': c.email || '',
    'Telefone': c.phone || ''
  }))
  utils.book_append_sheet(wb, utils.json_to_sheet(clientsData), 'Clientes')

  // Aba Casos
  const clientMap = new Map(clients.map(c => [c.id, c.name]))
  const casesData = cases.map(c => ({
    'Numero': c.case_number,
    'Titulo': c.title,
    'Cliente': clientMap.get(c.client_id) || 'N/A',
    'Status': c.status
  }))
  utils.book_append_sheet(wb, utils.json_to_sheet(casesData), 'Casos')

  // Aba Prazos
  const caseMap = new Map(cases.map(c => [c.id, c.title]))
  const deadlinesData = deadlines.map(d => ({
    'Titulo': d.title,
    'Caso': d.case_id ? caseMap.get(d.case_id) || 'N/A' : 'Geral',
    'Vencimento': new Date(d.due_date).toLocaleDateString('pt-BR'),
    'Status': d.completed ? 'Concluido' : 'Pendente'
  }))
  utils.book_append_sheet(wb, utils.json_to_sheet(deadlinesData), 'Prazos')

  writeFile(wb, `relatorio_completo_${formatDateFile()}.xlsx`)
}

function formatDateFile(): string {
  return new Date().toISOString().split('T')[0]
}
```

**Novo arquivo:** `src/lib/exportPdf.ts`
```typescript
import { pdf } from '@react-pdf/renderer'
import { saveAs } from 'file-saver'
import { ClientReportPDF } from '@/components/reports/ClientReport'
import { DeadlineReportPDF } from '@/components/reports/DeadlineReport'
import type { Client, Deadline, Case } from '@/types'

export async function exportClientsToPdf(
  clients: Client[],
  lawyerName?: string
) {
  const blob = await pdf(
    <ClientReportPDF clients={clients} lawyerName={lawyerName} />
  ).toBlob()
  saveAs(blob, `clientes_${formatDateFile()}.pdf`)
}

export async function exportDeadlinesToPdf(
  deadlines: Deadline[],
  cases: Case[],
  period?: { start: Date; end: Date }
) {
  const blob = await pdf(
    <DeadlineReportPDF deadlines={deadlines} cases={cases} period={period} />
  ).toBlob()
  saveAs(blob, `prazos_${formatDateFile()}.pdf`)
}

function formatDateFile(): string {
  return new Date().toISOString().split('T')[0]
}
```

**Novo componente:** `src/components/reports/ClientReport.tsx`
```typescript
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Client } from '@/types'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
    borderBottom: '2px solid #333',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  table: {
    display: 'flex',
    width: 'auto',
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #ddd',
    minHeight: 25,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
    padding: 5,
  },
  tableCellName: {
    flex: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#999',
    fontSize: 8,
  },
})

interface Props {
  clients: Client[]
  lawyerName?: string
}

export const ClientReportPDF = ({ clients, lawyerName }: Props) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Relatorio de Clientes</Text>
        <Text style={styles.subtitle}>
          {lawyerName && `${lawyerName} | `}
          Gerado em {new Date().toLocaleDateString('pt-BR')} |
          Total: {clients.length} cliente(s)
        </Text>
      </View>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, styles.tableCellName]}>Nome</Text>
          <Text style={styles.tableCell}>CPF/CNPJ</Text>
          <Text style={styles.tableCell}>Telefone</Text>
          <Text style={styles.tableCell}>Email</Text>
        </View>

        {clients.map((client) => (
          <View key={client.id} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellName]}>
              {client.name}
            </Text>
            <Text style={styles.tableCell}>{client.cpf_cnpj || '-'}</Text>
            <Text style={styles.tableCell}>{client.phone || '-'}</Text>
            <Text style={styles.tableCell}>{client.email || '-'}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>
        JurisDesk - Sistema de Gestao Juridica
      </Text>
    </Page>
  </Document>
)
```

**Integracao na pagina Clients.tsx:**
```typescript
// Adicionar imports
import { Download } from 'lucide-react'
import { exportClientsToExcel } from '@/lib/exportExcel'
import { exportClientsToPdf } from '@/lib/exportPdf'

// Adicionar botoes no header da pagina
<div className="flex gap-2">
  <button
    onClick={() => exportClientsToExcel(clients)}
    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
  >
    <Download className="size-4" />
    Excel
  </button>
  <button
    onClick={() => exportClientsToPdf(clients, settings.lawyer_name)}
    className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
  >
    <Download className="size-4" />
    PDF
  </button>
</div>
```

---

### 10.2 Modelos de Documentos Juridicos

#### Backend (Tauri/Rust)

**Nova tabela SQLite** (adicionar em `src/lib/db.ts`):
```sql
CREATE TABLE IF NOT EXISTS generated_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_name TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  case_id INTEGER REFERENCES cases(id),
  output_filename TEXT NOT NULL,
  variables_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Comando Tauri para salvar arquivo** (opcional, pode usar dialog plugin):
```rust
// src-tauri/src/main.rs
#[tauri::command]
async fn save_generated_document(
    path: String,
    content: Vec<u8>
) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| e.to_string())
}
```

#### Frontend (React/TypeScript)

**Novo arquivo:** `src/lib/documentTemplates.ts`
```typescript
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { saveAs } from 'file-saver'
import type { Client } from '@/types'

export interface TemplateConfig {
  id: string
  name: string
  filename: string
  description: string
  variables: string[]
}

export const AVAILABLE_TEMPLATES: TemplateConfig[] = [
  {
    id: 'procuracao',
    name: 'Procuracao Ad Judicia',
    filename: 'procuracao.docx',
    description: 'Procuracao para representacao em processos judiciais',
    variables: ['cliente_nome', 'cliente_cpf', 'cliente_endereco', 'advogado_nome', 'advogado_oab', 'poderes', 'data_extenso']
  },
  {
    id: 'contrato_honorarios',
    name: 'Contrato de Honorarios',
    filename: 'contrato_honorarios.docx',
    description: 'Contrato de prestacao de servicos advocaticios',
    variables: ['cliente_nome', 'cliente_cpf', 'valor', 'valor_extenso', 'forma_pagamento', 'objeto', 'data_extenso']
  },
  {
    id: 'declaracao_hipossuficiencia',
    name: 'Declaracao de Hipossuficiencia',
    filename: 'declaracao_hipossuficiencia.docx',
    description: 'Declaracao de pobreza para justica gratuita',
    variables: ['cliente_nome', 'cliente_cpf', 'cliente_endereco', 'data_extenso']
  },
  {
    id: 'substabelecimento',
    name: 'Substabelecimento',
    filename: 'substabelecimento.docx',
    description: 'Transferencia de poderes entre advogados',
    variables: ['advogado_origem', 'advogado_origem_oab', 'advogado_destino', 'advogado_destino_oab', 'poderes', 'data_extenso']
  }
]

export async function generateDocument(
  templateId: string,
  data: Record<string, string>,
  outputName?: string
): Promise<void> {
  const template = AVAILABLE_TEMPLATES.find(t => t.id === templateId)
  if (!template) throw new Error('Template nao encontrado')

  // Carregar template da pasta public
  const response = await fetch(`/templates/${template.filename}`)
  if (!response.ok) throw new Error('Erro ao carregar template')

  const templateBuffer = await response.arrayBuffer()
  const zip = new PizZip(templateBuffer)

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' }
  })

  // Preencher variaveis
  doc.render(data)

  // Gerar arquivo
  const output = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })

  const filename = outputName || `${template.id}_${Date.now()}.docx`
  saveAs(output, filename)
}

// Funcao auxiliar para formatar data por extenso
export function formatDateExtended(date: Date): string {
  const months = [
    'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ]
  const day = date.getDate()
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  return `${day} de ${month} de ${year}`
}

// Funcao para preencher dados do cliente automaticamente
export function getClientVariables(client: Client): Record<string, string> {
  return {
    cliente_nome: client.name,
    cliente_cpf: client.cpf_cnpj || '',
    cliente_endereco: client.address || '',
    cliente_email: client.email || '',
    cliente_telefone: client.phone || ''
  }
}
```

**Novo store:** `src/stores/templateStore.ts`
```typescript
import { create } from 'zustand'
import { executeQuery, executeInsert } from '@/lib/db'

interface GeneratedDocument {
  id: number
  template_name: string
  client_id: number | null
  case_id: number | null
  output_filename: string
  variables_json: string
  created_at: string
}

interface TemplateStore {
  generatedDocs: GeneratedDocument[]
  fetchGeneratedDocs: () => Promise<void>
  logGeneratedDoc: (doc: Omit<GeneratedDocument, 'id' | 'created_at'>) => Promise<void>
}

export const useTemplateStore = create<TemplateStore>((set) => ({
  generatedDocs: [],

  fetchGeneratedDocs: async () => {
    const docs = await executeQuery<GeneratedDocument>(
      'SELECT * FROM generated_documents ORDER BY created_at DESC LIMIT 100'
    )
    set({ generatedDocs: docs })
  },

  logGeneratedDoc: async (doc) => {
    await executeInsert(
      `INSERT INTO generated_documents (template_name, client_id, case_id, output_filename, variables_json)
       VALUES (?, ?, ?, ?, ?)`,
      [doc.template_name, doc.client_id, doc.case_id, doc.output_filename, doc.variables_json]
    )
  }
}))
```

**Nova pagina:** `src/pages/Templates.tsx`
```typescript
import { useState } from 'react'
import { FileText, Download, User, History } from 'lucide-react'
import { useClientStore } from '@/stores/clientStore'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  AVAILABLE_TEMPLATES,
  generateDocument,
  getClientVariables,
  formatDateExtended
} from '@/lib/documentTemplates'
import type { TemplateConfig } from '@/lib/documentTemplates'

export default function Templates() {
  const { clients } = useClientStore()
  const { settings } = useSettingsStore()
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [customVariables, setCustomVariables] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)

  const selectedClient = clients.find(c => c.id === selectedClientId)

  const handleGenerate = async () => {
    if (!selectedTemplate) return

    setGenerating(true)
    try {
      // Montar variaveis
      const variables: Record<string, string> = {
        ...customVariables,
        advogado_nome: settings.lawyer_name || '',
        advogado_oab: settings.lawyer_oab || '',
        data_extenso: formatDateExtended(new Date())
      }

      // Adicionar dados do cliente se selecionado
      if (selectedClient) {
        Object.assign(variables, getClientVariables(selectedClient))
      }

      const filename = selectedClient
        ? `${selectedTemplate.id}_${selectedClient.name.replace(/\s+/g, '_')}.docx`
        : `${selectedTemplate.id}_${Date.now()}.docx`

      await generateDocument(selectedTemplate.id, variables, filename)
    } catch (error) {
      console.error('Erro ao gerar documento:', error)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Modelos de Documentos</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Templates */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white">Templates Disponiveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AVAILABLE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'bg-primary/20 border-primary'
                    : 'bg-surface-dark border-border-dark hover:border-primary/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <FileText className="size-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-medium text-white">{template.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{template.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Painel de Geracao */}
        <div className="bg-surface-dark border border-border-dark rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Gerar Documento</h2>

          {selectedTemplate ? (
            <div className="space-y-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm text-primary font-medium">{selectedTemplate.name}</p>
              </div>

              {/* Selecionar Cliente */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  <User className="size-4 inline mr-1" />
                  Selecionar Cliente (opcional)
                </label>
                <select
                  value={selectedClientId || ''}
                  onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Nenhum cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Variaveis adicionais */}
              {selectedTemplate.variables
                .filter(v => !v.startsWith('cliente_') && !v.startsWith('advogado_') && v !== 'data_extenso')
                .map((variable) => (
                  <div key={variable}>
                    <label className="block text-sm text-gray-400 mb-2">
                      {variable.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="text"
                      value={customVariables[variable] || ''}
                      onChange={(e) => setCustomVariables(prev => ({
                        ...prev,
                        [variable]: e.target.value
                      }))}
                      className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                ))}

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium disabled:opacity-50"
              >
                <Download className="size-4" />
                {generating ? 'Gerando...' : 'Gerar Documento'}
              </button>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">
              Selecione um template ao lado para comecar
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Sidebar.tsx - Adicionar link:**
```typescript
{ icon: FileText, label: 'Modelos', path: '/templates' },
```

---

### 10.3 Integracao com Tribunais

#### Backend (Tauri/Rust)

**Nova tabela SQLite** para armazenar movimentacoes:
```sql
CREATE TABLE IF NOT EXISTS case_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(id),
  movement_date TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  external_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(case_id, movement_date, description)
);

-- Adicionar coluna na tabela cases
ALTER TABLE cases ADD COLUMN process_number TEXT;
ALTER TABLE cases ADD COLUMN last_sync TEXT;
```

**Opcional: Comando Tauri para requisicoes HTTP** (se preferir fazer no Rust):
```rust
// src-tauri/src/main.rs
use reqwest;

#[tauri::command]
async fn fetch_datajud(
    process_number: String,
    tribunal: String
) -> Result<String, String> {
    let url = format!(
        "https://api-publica.datajud.cnj.jus.br/api_publica_{}/_search",
        tribunal
    );

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .body(format!(
            r#"{{"query":{{"match":{{"numeroProcesso":"{}"}}}}}}"#,
            process_number.replace(|c: char| !c.is_numeric(), "")
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    response.text().await.map_err(|e| e.to_string())
}
```

#### Frontend (React/TypeScript)

**Novo arquivo:** `src/lib/datajud.ts`
```typescript
const DATAJUD_URL = 'https://api-publica.datajud.cnj.jus.br'

// API Key publica do DataJud (gratuita)
// Obter versao atualizada em: https://datajud-wiki.cnj.jus.br/api-publica/acesso/
const DATAJUD_API_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='

// Mapeamento de tribunais
export const TRIBUNAIS = {
  'tjsp': 'Tribunal de Justica de Sao Paulo',
  'tjrj': 'Tribunal de Justica do Rio de Janeiro',
  'tjmg': 'Tribunal de Justica de Minas Gerais',
  'tjrs': 'Tribunal de Justica do Rio Grande do Sul',
  'tjpr': 'Tribunal de Justica do Parana',
  'trf1': 'Tribunal Regional Federal da 1a Regiao',
  'trf2': 'Tribunal Regional Federal da 2a Regiao',
  'trf3': 'Tribunal Regional Federal da 3a Regiao',
  'trf4': 'Tribunal Regional Federal da 4a Regiao',
  'trf5': 'Tribunal Regional Federal da 5a Regiao',
  'tst': 'Tribunal Superior do Trabalho',
  'stj': 'Superior Tribunal de Justica',
  'stf': 'Supremo Tribunal Federal',
} as const

export type TribunalCode = keyof typeof TRIBUNAIS

export interface MovimentoProcessual {
  nome: string
  dataHora: string
  complemento?: string
}

export interface ProcessoDatajud {
  numeroProcesso: string
  classe: { codigo: number; nome: string }
  sistema: { codigo: number; nome: string }
  formato: { codigo: number; nome: string }
  tribunal: string
  dataAjuizamento: string
  grau: string
  orgaoJulgador: { codigo: number; nome: string }
  movimentos: MovimentoProcessual[]
  assuntos: Array<{ codigo: number; nome: string }>
}

export interface DatajudResponse {
  hits: {
    total: { value: number }
    hits: Array<{
      _source: ProcessoDatajud
    }>
  }
}

export async function consultarProcesso(
  numeroProcesso: string,
  tribunal: TribunalCode
): Promise<ProcessoDatajud | null> {
  try {
    // Remover caracteres nao numericos
    const numeroLimpo = numeroProcesso.replace(/\D/g, '')

    const response = await fetch(
      `${DATAJUD_URL}/api_publica_${tribunal}/_search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `APIKey ${DATAJUD_API_KEY}`
        },
        body: JSON.stringify({
          query: {
            match: {
              numeroProcesso: numeroLimpo
            }
          }
        })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data: DatajudResponse = await response.json()

    if (data.hits.total.value === 0) {
      return null
    }

    return data.hits.hits[0]._source
  } catch (error) {
    console.error('Erro ao consultar DataJud:', error)
    throw error
  }
}

// Extrair tribunal do numero do processo (formato CNJ)
export function extractTribunalFromProcess(numeroProcesso: string): TribunalCode | null {
  // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
  // J = Justica (8 = Estadual, 4 = Federal, 5 = Trabalho)
  // TR = Tribunal (ex: 26 = TJSP)

  const match = numeroProcesso.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/)
  if (!match) return null

  const justica = match[1]
  const tribunal = match[2]

  // Mapeamento simplificado
  if (justica === '8') {
    const estaduais: Record<string, TribunalCode> = {
      '26': 'tjsp',
      '19': 'tjrj',
      '13': 'tjmg',
      '21': 'tjrs',
      '16': 'tjpr',
    }
    return estaduais[tribunal] || null
  }

  if (justica === '4') {
    const federais: Record<string, TribunalCode> = {
      '01': 'trf1',
      '02': 'trf2',
      '03': 'trf3',
      '04': 'trf4',
      '05': 'trf5',
    }
    return federais[tribunal] || null
  }

  return null
}
```

**Novo store:** `src/stores/movementStore.ts`
```typescript
import { create } from 'zustand'
import { executeQuery, executeInsert, executeUpdate } from '@/lib/db'
import { consultarProcesso, type ProcessoDatajud } from '@/lib/datajud'

interface Movement {
  id: number
  case_id: number
  movement_date: string
  description: string
  source: string
  external_id: string | null
  created_at: string
}

interface MovementStore {
  movements: Movement[]
  loading: boolean
  fetchMovements: (caseId: number) => Promise<void>
  syncWithDatajud: (caseId: number, processNumber: string, tribunal: string) => Promise<number>
}

export const useMovementStore = create<MovementStore>((set, get) => ({
  movements: [],
  loading: false,

  fetchMovements: async (caseId) => {
    const movements = await executeQuery<Movement>(
      'SELECT * FROM case_movements WHERE case_id = ? ORDER BY movement_date DESC',
      [caseId]
    )
    set({ movements })
  },

  syncWithDatajud: async (caseId, processNumber, tribunal) => {
    set({ loading: true })
    try {
      const processo = await consultarProcesso(processNumber, tribunal as any)
      if (!processo) return 0

      let imported = 0
      for (const mov of processo.movimentos) {
        try {
          await executeInsert(
            `INSERT OR IGNORE INTO case_movements
             (case_id, movement_date, description, source, external_id)
             VALUES (?, ?, ?, 'datajud', ?)`,
            [caseId, mov.dataHora, mov.nome, `${processNumber}_${mov.dataHora}`]
          )
          imported++
        } catch {
          // Ignorar duplicados
        }
      }

      // Atualizar data de sync no caso
      await executeUpdate(
        'UPDATE cases SET last_sync = ? WHERE id = ?',
        [new Date().toISOString(), caseId]
      )

      await get().fetchMovements(caseId)
      return imported
    } finally {
      set({ loading: false })
    }
  }
}))
```

**Componente para exibir movimentacoes:** `src/components/cases/CaseMovements.tsx`
```typescript
import { useEffect, useState } from 'react'
import { RefreshCw, Calendar, ExternalLink } from 'lucide-react'
import { useMovementStore } from '@/stores/movementStore'
import { TRIBUNAIS, type TribunalCode } from '@/lib/datajud'

interface Props {
  caseId: number
  processNumber?: string
}

export function CaseMovements({ caseId, processNumber }: Props) {
  const { movements, loading, fetchMovements, syncWithDatajud } = useMovementStore()
  const [tribunal, setTribunal] = useState<TribunalCode>('tjsp')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  useEffect(() => {
    fetchMovements(caseId)
  }, [caseId, fetchMovements])

  const handleSync = async () => {
    if (!processNumber) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const count = await syncWithDatajud(caseId, processNumber, tribunal)
      setSyncResult(`${count} movimentacao(es) importada(s)`)
    } catch (error) {
      setSyncResult('Erro ao consultar tribunal')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de sincronizacao */}
      {processNumber && (
        <div className="flex items-center gap-3 p-3 bg-surface-highlight rounded-lg">
          <select
            value={tribunal}
            onChange={(e) => setTribunal(e.target.value as TribunalCode)}
            className="bg-background-dark border border-border-dark rounded px-2 py-1 text-sm text-white"
          >
            {Object.entries(TRIBUNAIS).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-1 bg-primary hover:bg-primary-dark text-white rounded text-sm disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
          {syncResult && (
            <span className="text-sm text-gray-400">{syncResult}</span>
          )}
        </div>
      )}

      {/* Lista de movimentacoes */}
      <div className="space-y-2">
        {movements.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">
            Nenhuma movimentacao registrada
          </p>
        ) : (
          movements.map((mov) => (
            <div
              key={mov.id}
              className="flex items-start gap-3 p-3 bg-surface-dark rounded-lg border border-border-dark"
            >
              <Calendar className="size-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-white text-sm">{mov.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">
                    {new Date(mov.movement_date).toLocaleDateString('pt-BR')}
                  </span>
                  {mov.source === 'datajud' && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                      DataJud
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

---

### 10.4 Agenda e Compromissos

#### Backend (Tauri/Rust)

**Nova tabela SQLite** (adicionar em `src/lib/db.ts`):
```sql
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  location TEXT,
  type TEXT CHECK(type IN ('reuniao', 'audiencia', 'compromisso', 'outro')) DEFAULT 'outro',
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
  reminder_minutes INTEGER DEFAULT 30,
  google_event_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_date);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
```

#### Frontend (React/TypeScript)

**Novo tipo:** `src/types/index.ts`
```typescript
export interface Appointment {
  id: number
  title: string
  description: string | null
  start_date: string
  end_date: string | null
  location: string | null
  type: 'reuniao' | 'audiencia' | 'compromisso' | 'outro'
  client_id: number | null
  case_id: number | null
  reminder_minutes: number
  google_event_id: string | null
  created_at: string
  updated_at: string
}

export type AppointmentType = Appointment['type']
```

**Novo store:** `src/stores/appointmentStore.ts`
```typescript
import { create } from 'zustand'
import { executeQuery, executeInsert, executeUpdate, executeDelete } from '@/lib/db'
import { logActivity } from '@/lib/activityLogger'
import { triggerBackup } from '@/lib/autoBackup'
import type { Appointment } from '@/types'

interface AppointmentStore {
  appointments: Appointment[]
  loading: boolean
  fetchAppointments: () => Promise<void>
  getAppointmentsByDate: (date: Date) => Appointment[]
  getAppointmentsByRange: (start: Date, end: Date) => Promise<Appointment[]>
  createAppointment: (appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => Promise<number>
  updateAppointment: (id: number, appointment: Partial<Appointment>) => Promise<void>
  deleteAppointment: (id: number) => Promise<void>
}

export const useAppointmentStore = create<AppointmentStore>((set, get) => ({
  appointments: [],
  loading: false,

  fetchAppointments: async () => {
    set({ loading: true })
    try {
      const appointments = await executeQuery<Appointment>(
        'SELECT * FROM appointments ORDER BY start_date ASC'
      )
      set({ appointments })
    } finally {
      set({ loading: false })
    }
  },

  getAppointmentsByDate: (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return get().appointments.filter(a =>
      a.start_date.startsWith(dateStr)
    )
  },

  getAppointmentsByRange: async (start, end) => {
    return executeQuery<Appointment>(
      `SELECT * FROM appointments
       WHERE start_date >= ? AND start_date <= ?
       ORDER BY start_date ASC`,
      [start.toISOString(), end.toISOString()]
    )
  },

  createAppointment: async (appointment) => {
    const id = await executeInsert(
      `INSERT INTO appointments
       (title, description, start_date, end_date, location, type, client_id, case_id, reminder_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointment.title,
        appointment.description,
        appointment.start_date,
        appointment.end_date,
        appointment.location,
        appointment.type,
        appointment.client_id,
        appointment.case_id,
        appointment.reminder_minutes
      ]
    )

    await logActivity('appointment', id, 'create', `Compromisso criado: ${appointment.title}`)
    await get().fetchAppointments()
    triggerBackup()

    return id
  },

  updateAppointment: async (id, appointment) => {
    const fields = Object.keys(appointment)
      .map(key => `${key} = ?`)
      .join(', ')
    const values = Object.values(appointment)

    await executeUpdate(
      `UPDATE appointments SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    )

    await logActivity('appointment', id, 'update', 'Compromisso atualizado')
    await get().fetchAppointments()
    triggerBackup()
  },

  deleteAppointment: async (id) => {
    const appointment = get().appointments.find(a => a.id === id)
    await executeDelete('DELETE FROM appointments WHERE id = ?', [id])

    if (appointment) {
      await logActivity('appointment', id, 'delete', `Compromisso removido: ${appointment.title}`)
    }

    set(state => ({
      appointments: state.appointments.filter(a => a.id !== id)
    }))
    triggerBackup()
  }
}))
```

**Componente de formulario:** `src/components/appointments/AppointmentForm.tsx`
```typescript
import { useState } from 'react'
import { X, Calendar, Clock, MapPin, User, Briefcase } from 'lucide-react'
import { useAppointmentStore } from '@/stores/appointmentStore'
import { useClientStore } from '@/stores/clientStore'
import { useCaseStore } from '@/stores/caseStore'
import type { Appointment, AppointmentType } from '@/types'

interface Props {
  appointment?: Appointment
  initialDate?: Date
  onClose: () => void
}

const APPOINTMENT_TYPES: { value: AppointmentType; label: string; color: string }[] = [
  { value: 'reuniao', label: 'Reuniao', color: 'bg-blue-500' },
  { value: 'audiencia', label: 'Audiencia', color: 'bg-purple-500' },
  { value: 'compromisso', label: 'Compromisso', color: 'bg-emerald-500' },
  { value: 'outro', label: 'Outro', color: 'bg-gray-500' },
]

export function AppointmentForm({ appointment, initialDate, onClose }: Props) {
  const { createAppointment, updateAppointment } = useAppointmentStore()
  const { clients } = useClientStore()
  const { cases } = useCaseStore()

  const [form, setForm] = useState({
    title: appointment?.title || '',
    description: appointment?.description || '',
    start_date: appointment?.start_date || initialDate?.toISOString().slice(0, 16) || '',
    end_date: appointment?.end_date || '',
    location: appointment?.location || '',
    type: appointment?.type || 'outro' as AppointmentType,
    client_id: appointment?.client_id || null as number | null,
    case_id: appointment?.case_id || null as number | null,
    reminder_minutes: appointment?.reminder_minutes || 30,
  })

  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.start_date) return

    setSaving(true)
    try {
      if (appointment) {
        await updateAppointment(appointment.id, form)
      } else {
        await createAppointment({
          ...form,
          google_event_id: null
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-dark border border-border-dark rounded-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {appointment ? 'Editar Compromisso' : 'Novo Compromisso'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Titulo *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                <Calendar className="size-4 inline mr-1" />
                Inicio *
              </label>
              <input
                type="datetime-local"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                <Clock className="size-4 inline mr-1" />
                Fim
              </label>
              <input
                type="datetime-local"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Tipo</label>
            <div className="flex gap-2">
              {APPOINTMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm({ ...form, type: type.value })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    form.type === type.value
                      ? `${type.color} text-white`
                      : 'bg-background-dark text-gray-400 hover:text-white'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              <MapPin className="size-4 inline mr-1" />
              Local
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Endereco ou sala"
              className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                <User className="size-4 inline mr-1" />
                Cliente
              </label>
              <select
                value={form.client_id || ''}
                onChange={(e) => setForm({ ...form, client_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white"
              >
                <option value="">Nenhum</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                <Briefcase className="size-4 inline mr-1" />
                Caso
              </label>
              <select
                value={form.case_id || ''}
                onChange={(e) => setForm({ ...form, case_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white"
              >
                <option value="">Nenhum</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Descricao</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-surface-highlight text-white rounded-lg hover:bg-surface-highlight/80"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.title || !form.start_date}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

**Integracao com Calendar.tsx:**
```typescript
// Adicionar imports
import { useAppointmentStore } from '@/stores/appointmentStore'
import { AppointmentForm } from '@/components/appointments/AppointmentForm'

// No componente Calendar, adicionar:
const { appointments, fetchAppointments } = useAppointmentStore()

// Ao carregar dados:
useEffect(() => {
  fetchAppointments()
}, [])

// Renderizar compromissos junto com prazos no calendario
// Usar cores diferentes: prazos = vermelho, compromissos = azul
```

---

### 10.5 Controle Financeiro Basico

#### Backend (Tauri/Rust)

**Nova tabela SQLite:**
```sql
CREATE TABLE IF NOT EXISTS financial_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
  type TEXT CHECK(type IN ('honorario', 'despesa', 'reembolso')) NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT,
  paid_date TEXT,
  status TEXT CHECK(status IN ('pendente', 'pago', 'cancelado')) DEFAULT 'pendente',
  payment_method TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_client ON financial_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_status ON financial_entries(status);
CREATE INDEX IF NOT EXISTS idx_financial_due ON financial_entries(due_date);
```

#### Frontend (React/TypeScript)

**Novo tipo:** `src/types/index.ts`
```typescript
export interface FinancialEntry {
  id: number
  client_id: number
  case_id: number | null
  type: 'honorario' | 'despesa' | 'reembolso'
  description: string
  amount: number
  due_date: string | null
  paid_date: string | null
  status: 'pendente' | 'pago' | 'cancelado'
  payment_method: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type FinancialType = FinancialEntry['type']
export type FinancialStatus = FinancialEntry['status']
```

**Novo store:** `src/stores/financialStore.ts`
```typescript
import { create } from 'zustand'
import { executeQuery, executeInsert, executeUpdate, executeDelete } from '@/lib/db'
import { logActivity } from '@/lib/activityLogger'
import { triggerBackup } from '@/lib/autoBackup'
import type { FinancialEntry } from '@/types'

interface FinancialSummary {
  totalReceived: number
  totalPending: number
  totalOverdue: number
  totalExpenses: number
}

interface FinancialStore {
  entries: FinancialEntry[]
  loading: boolean
  fetchEntries: () => Promise<void>
  getEntriesByClient: (clientId: number) => FinancialEntry[]
  getSummary: () => FinancialSummary
  getSummaryByClient: (clientId: number) => FinancialSummary
  createEntry: (entry: Omit<FinancialEntry, 'id' | 'created_at' | 'updated_at'>) => Promise<number>
  updateEntry: (id: number, entry: Partial<FinancialEntry>) => Promise<void>
  markAsPaid: (id: number, paidDate?: string) => Promise<void>
  deleteEntry: (id: number) => Promise<void>
}

export const useFinancialStore = create<FinancialStore>((set, get) => ({
  entries: [],
  loading: false,

  fetchEntries: async () => {
    set({ loading: true })
    try {
      const entries = await executeQuery<FinancialEntry>(
        'SELECT * FROM financial_entries ORDER BY created_at DESC'
      )
      set({ entries })
    } finally {
      set({ loading: false })
    }
  },

  getEntriesByClient: (clientId) => {
    return get().entries.filter(e => e.client_id === clientId)
  },

  getSummary: () => {
    const entries = get().entries
    const today = new Date().toISOString().split('T')[0]

    return {
      totalReceived: entries
        .filter(e => e.type === 'honorario' && e.status === 'pago')
        .reduce((sum, e) => sum + e.amount, 0),
      totalPending: entries
        .filter(e => e.type === 'honorario' && e.status === 'pendente')
        .reduce((sum, e) => sum + e.amount, 0),
      totalOverdue: entries
        .filter(e => e.status === 'pendente' && e.due_date && e.due_date < today)
        .reduce((sum, e) => sum + e.amount, 0),
      totalExpenses: entries
        .filter(e => e.type === 'despesa' && e.status === 'pago')
        .reduce((sum, e) => sum + e.amount, 0),
    }
  },

  getSummaryByClient: (clientId) => {
    const entries = get().entries.filter(e => e.client_id === clientId)
    const today = new Date().toISOString().split('T')[0]

    return {
      totalReceived: entries
        .filter(e => e.type === 'honorario' && e.status === 'pago')
        .reduce((sum, e) => sum + e.amount, 0),
      totalPending: entries
        .filter(e => e.type === 'honorario' && e.status === 'pendente')
        .reduce((sum, e) => sum + e.amount, 0),
      totalOverdue: entries
        .filter(e => e.status === 'pendente' && e.due_date && e.due_date < today)
        .reduce((sum, e) => sum + e.amount, 0),
      totalExpenses: entries
        .filter(e => e.type === 'despesa' && e.status === 'pago')
        .reduce((sum, e) => sum + e.amount, 0),
    }
  },

  createEntry: async (entry) => {
    const id = await executeInsert(
      `INSERT INTO financial_entries
       (client_id, case_id, type, description, amount, due_date, status, payment_method, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.client_id,
        entry.case_id,
        entry.type,
        entry.description,
        entry.amount,
        entry.due_date,
        entry.status,
        entry.payment_method,
        entry.notes
      ]
    )

    await logActivity('financial', id, 'create', `Lancamento criado: ${entry.description}`)
    await get().fetchEntries()
    triggerBackup()

    return id
  },

  updateEntry: async (id, entry) => {
    const fields = Object.keys(entry)
      .map(key => `${key} = ?`)
      .join(', ')
    const values = Object.values(entry)

    await executeUpdate(
      `UPDATE financial_entries SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    )

    await logActivity('financial', id, 'update', 'Lancamento atualizado')
    await get().fetchEntries()
    triggerBackup()
  },

  markAsPaid: async (id, paidDate) => {
    await executeUpdate(
      'UPDATE financial_entries SET status = ?, paid_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['pago', paidDate || new Date().toISOString(), id]
    )

    await logActivity('financial', id, 'update', 'Lancamento marcado como pago')
    await get().fetchEntries()
    triggerBackup()
  },

  deleteEntry: async (id) => {
    const entry = get().entries.find(e => e.id === id)
    await executeDelete('DELETE FROM financial_entries WHERE id = ?', [id])

    if (entry) {
      await logActivity('financial', id, 'delete', `Lancamento removido: ${entry.description}`)
    }

    set(state => ({
      entries: state.entries.filter(e => e.id !== id)
    }))
    triggerBackup()
  }
}))
```

**Nova pagina:** `src/pages/Financial.tsx`
```typescript
import { useEffect, useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Plus,
  Check,
  Filter
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { useClientStore } from '@/stores/clientStore'
import { FinancialForm } from '@/components/financial/FinancialForm'
import type { FinancialStatus, FinancialType } from '@/types'

export default function Financial() {
  const { entries, loading, fetchEntries, getSummary, markAsPaid } = useFinancialStore()
  const { clients } = useClientStore()
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FinancialStatus | 'all'>('all')
  const [filterType, setFilterType] = useState<FinancialType | 'all'>('all')

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const summary = getSummary()
  const clientMap = new Map(clients.map(c => [c.id, c.name]))

  const filteredEntries = entries.filter(e => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterType !== 'all' && e.type !== filterType) return false
    return true
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Financeiro</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg"
        >
          <Plus className="size-4" />
          Novo Lancamento
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-dark border border-border-dark rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-500/20 p-2 rounded-lg">
              <TrendingUp className="size-5 text-emerald-400" />
            </div>
            <span className="text-gray-400 text-sm">Recebido</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {formatCurrency(summary.totalReceived)}
          </p>
        </div>

        <div className="bg-surface-dark border border-border-dark rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-amber-500/20 p-2 rounded-lg">
              <DollarSign className="size-5 text-amber-400" />
            </div>
            <span className="text-gray-400 text-sm">A Receber</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {formatCurrency(summary.totalPending)}
          </p>
        </div>

        <div className="bg-surface-dark border border-border-dark rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-500/20 p-2 rounded-lg">
              <AlertCircle className="size-5 text-red-400" />
            </div>
            <span className="text-gray-400 text-sm">Atrasado</span>
          </div>
          <p className="text-2xl font-bold text-red-400">
            {formatCurrency(summary.totalOverdue)}
          </p>
        </div>

        <div className="bg-surface-dark border border-border-dark rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <TrendingDown className="size-5 text-blue-400" />
            </div>
            <span className="text-gray-400 text-sm">Despesas</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {formatCurrency(summary.totalExpenses)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <Filter className="size-4 text-gray-400" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="all">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="all">Todos os tipos</option>
          <option value="honorario">Honorario</option>
          <option value="despesa">Despesa</option>
          <option value="reembolso">Reembolso</option>
        </select>
      </div>

      {/* Tabela de Lancamentos */}
      <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-highlight text-white text-xs uppercase">
            <tr>
              <th className="px-5 py-3">Descricao</th>
              <th className="px-5 py-3">Cliente</th>
              <th className="px-5 py-3">Tipo</th>
              <th className="px-5 py-3">Valor</th>
              <th className="px-5 py-3">Vencimento</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-dark">
            {filteredEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-surface-highlight/30">
                <td className="px-5 py-4 text-white">{entry.description}</td>
                <td className="px-5 py-4 text-gray-400">
                  {clientMap.get(entry.client_id) || 'N/A'}
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    entry.type === 'honorario' ? 'bg-emerald-500/20 text-emerald-400' :
                    entry.type === 'despesa' ? 'bg-red-500/20 text-red-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {entry.type}
                  </span>
                </td>
                <td className="px-5 py-4 text-white font-medium">
                  {formatCurrency(entry.amount)}
                </td>
                <td className="px-5 py-4 text-gray-400">
                  {entry.due_date
                    ? new Date(entry.due_date).toLocaleDateString('pt-BR')
                    : '-'
                  }
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    entry.status === 'pago' ? 'bg-emerald-500/20 text-emerald-400' :
                    entry.status === 'pendente' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {entry.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {entry.status === 'pendente' && (
                    <button
                      onClick={() => markAsPaid(entry.id)}
                      className="text-emerald-400 hover:text-emerald-300"
                      title="Marcar como pago"
                    >
                      <Check className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredEntries.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Nenhum lancamento encontrado
          </div>
        )}
      </div>

      {showForm && <FinancialForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
```

**Sidebar.tsx - Adicionar link:**
```typescript
{ icon: DollarSign, label: 'Financeiro', path: '/financial' },
```

---

## 11. Requisitos de Testes

Cada funcionalidade proposta **DEVE** incluir testes automatizados antes de ser considerada completa. Seguir o padrao do projeto usando **Vitest** + **React Testing Library**.

---

### 11.1 Testes para Relatorios e Exportacao

#### Arquivo: `src/lib/exportExcel.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportClientsToExcel, exportCasesToExcel, exportFullReport } from './exportExcel'
import type { Client, Case, Deadline } from '@/types'

// Mock SheetJS
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

describe('exportExcel', () => {
  const mockClients: Client[] = [
    {
      id: 1,
      name: 'Joao Silva',
      cpf_cnpj: '123.456.789-00',
      email: 'joao@test.com',
      phone: '11999999999',
      address: 'Rua Teste, 123',
      created_at: '2024-01-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportClientsToExcel', () => {
    it('should export clients to Excel file', () => {
      exportClientsToExcel(mockClients)

      const xlsx = require('xlsx')
      expect(xlsx.utils.json_to_sheet).toHaveBeenCalled()
      expect(xlsx.utils.book_new).toHaveBeenCalled()
      expect(xlsx.writeFile).toHaveBeenCalled()
    })

    it('should format client data correctly', () => {
      exportClientsToExcel(mockClients)

      const xlsx = require('xlsx')
      const callArgs = xlsx.utils.json_to_sheet.mock.calls[0][0]

      expect(callArgs[0]).toHaveProperty('Nome', 'Joao Silva')
      expect(callArgs[0]).toHaveProperty('CPF/CNPJ', '123.456.789-00')
    })

    it('should handle empty client list', () => {
      exportClientsToExcel([])

      const xlsx = require('xlsx')
      expect(xlsx.utils.json_to_sheet).toHaveBeenCalledWith([])
    })

    it('should use custom filename when provided', () => {
      exportClientsToExcel(mockClients, 'custom_export.xlsx')

      const xlsx = require('xlsx')
      expect(xlsx.writeFile).toHaveBeenCalledWith(
        expect.anything(),
        'custom_export.xlsx'
      )
    })
  })

  describe('exportCasesToExcel', () => {
    const mockCases: Case[] = [
      {
        id: 1,
        client_id: 1,
        title: 'Caso Teste',
        case_number: '1234567-89.2024.8.26.0100',
        court: 'TJSP',
        case_type: 'Civel',
        status: 'ativo',
        created_at: '2024-01-01T00:00:00Z',
      },
    ]

    it('should export cases with client names', () => {
      exportCasesToExcel(mockCases, mockClients)

      const xlsx = require('xlsx')
      const callArgs = xlsx.utils.json_to_sheet.mock.calls[0][0]

      expect(callArgs[0]).toHaveProperty('Cliente', 'Joao Silva')
    })

    it('should show N/A for unknown client', () => {
      const casesWithUnknownClient = [{ ...mockCases[0], client_id: 999 }]
      exportCasesToExcel(casesWithUnknownClient, mockClients)

      const xlsx = require('xlsx')
      const callArgs = xlsx.utils.json_to_sheet.mock.calls[0][0]

      expect(callArgs[0]).toHaveProperty('Cliente', 'N/A')
    })
  })

  describe('exportFullReport', () => {
    it('should create workbook with multiple sheets', () => {
      exportFullReport(mockClients, [], [])

      const xlsx = require('xlsx')
      expect(xlsx.utils.book_append_sheet).toHaveBeenCalledTimes(3)
    })
  })
})
```

#### Arquivo: `src/lib/exportPdf.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { exportClientsToPdf, exportDeadlinesToPdf } from './exportPdf'

// Mock @react-pdf/renderer
vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn(() => ({
    toBlob: vi.fn(() => Promise.resolve(new Blob())),
  })),
  Document: vi.fn(({ children }) => children),
  Page: vi.fn(({ children }) => children),
  Text: vi.fn(({ children }) => children),
  View: vi.fn(({ children }) => children),
  StyleSheet: { create: vi.fn((styles) => styles) },
}))

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}))

describe('exportPdf', () => {
  it('should generate PDF blob and save file', async () => {
    const clients = [{ id: 1, name: 'Test', created_at: '2024-01-01' }]

    await exportClientsToPdf(clients as any)

    const { saveAs } = require('file-saver')
    expect(saveAs).toHaveBeenCalled()
  })

  it('should include lawyer name in PDF when provided', async () => {
    const clients = [{ id: 1, name: 'Test', created_at: '2024-01-01' }]

    await exportClientsToPdf(clients as any, 'Dr. Advogado')

    const { pdf } = require('@react-pdf/renderer')
    expect(pdf).toHaveBeenCalled()
  })
})
```

#### Arquivo: `src/components/reports/ClientReport.test.tsx`

```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ClientReportPDF } from './ClientReport'

// Nota: @react-pdf/renderer nao renderiza em JSDOM, entao testamos estrutura
describe('ClientReportPDF', () => {
  it('should render without crashing', () => {
    const clients = [
      { id: 1, name: 'Test Client', cpf_cnpj: '123', phone: '999', email: 'test@test.com', created_at: '2024-01-01' },
    ]

    // Este teste verifica que o componente pode ser instanciado
    expect(() => ClientReportPDF({ clients: clients as any })).not.toThrow()
  })

  it('should accept lawyerName prop', () => {
    const clients = []
    expect(() => ClientReportPDF({ clients, lawyerName: 'Dr. Test' })).not.toThrow()
  })
})
```

---

### 11.2 Testes para Modelos de Documentos

#### Arquivo: `src/lib/documentTemplates.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateDocument,
  formatDateExtended,
  getClientVariables,
  AVAILABLE_TEMPLATES,
} from './documentTemplates'
import type { Client } from '@/types'

// Mock fetch para carregar templates
global.fetch = vi.fn()

// Mock docxtemplater
vi.mock('docxtemplater', () => ({
  default: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    getZip: vi.fn(() => ({
      generate: vi.fn(() => new Blob()),
    })),
  })),
}))

vi.mock('pizzip', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}))

describe('documentTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })
  })

  describe('AVAILABLE_TEMPLATES', () => {
    it('should have at least 4 templates defined', () => {
      expect(AVAILABLE_TEMPLATES.length).toBeGreaterThanOrEqual(4)
    })

    it('should have required properties for each template', () => {
      AVAILABLE_TEMPLATES.forEach((template) => {
        expect(template).toHaveProperty('id')
        expect(template).toHaveProperty('name')
        expect(template).toHaveProperty('filename')
        expect(template).toHaveProperty('description')
        expect(template).toHaveProperty('variables')
        expect(Array.isArray(template.variables)).toBe(true)
      })
    })

    it('should include procuracao template', () => {
      const procuracao = AVAILABLE_TEMPLATES.find(t => t.id === 'procuracao')
      expect(procuracao).toBeDefined()
      expect(procuracao?.variables).toContain('cliente_nome')
    })
  })

  describe('generateDocument', () => {
    it('should fetch template file', async () => {
      await generateDocument('procuracao', { cliente_nome: 'Test' })

      expect(global.fetch).toHaveBeenCalledWith('/templates/procuracao.docx')
    })

    it('should throw error for invalid template', async () => {
      await expect(
        generateDocument('invalid_template', {})
      ).rejects.toThrow('Template nao encontrado')
    })

    it('should throw error when fetch fails', async () => {
      ;(global.fetch as any).mockResolvedValue({ ok: false })

      await expect(
        generateDocument('procuracao', {})
      ).rejects.toThrow('Erro ao carregar template')
    })

    it('should save file with custom name', async () => {
      await generateDocument('procuracao', {}, 'custom_output.docx')

      const { saveAs } = require('file-saver')
      expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'custom_output.docx')
    })
  })

  describe('formatDateExtended', () => {
    it('should format date in Portuguese extended format', () => {
      const date = new Date(2024, 0, 15) // 15 de janeiro de 2024
      expect(formatDateExtended(date)).toBe('15 de janeiro de 2024')
    })

    it('should handle different months correctly', () => {
      const march = new Date(2024, 2, 1)
      expect(formatDateExtended(march)).toContain('marco')

      const december = new Date(2024, 11, 25)
      expect(formatDateExtended(december)).toContain('dezembro')
    })
  })

  describe('getClientVariables', () => {
    it('should extract all client fields', () => {
      const client: Client = {
        id: 1,
        name: 'Joao Silva',
        cpf_cnpj: '123.456.789-00',
        email: 'joao@test.com',
        phone: '11999999999',
        address: 'Rua Teste, 123',
        created_at: '2024-01-01',
      }

      const vars = getClientVariables(client)

      expect(vars.cliente_nome).toBe('Joao Silva')
      expect(vars.cliente_cpf).toBe('123.456.789-00')
      expect(vars.cliente_endereco).toBe('Rua Teste, 123')
      expect(vars.cliente_email).toBe('joao@test.com')
      expect(vars.cliente_telefone).toBe('11999999999')
    })

    it('should handle null/undefined fields', () => {
      const client = {
        id: 1,
        name: 'Test',
        cpf_cnpj: null,
        email: undefined,
        created_at: '2024-01-01',
      } as any

      const vars = getClientVariables(client)

      expect(vars.cliente_cpf).toBe('')
      expect(vars.cliente_email).toBe('')
    })
  })
})
```

#### Arquivo: `src/stores/templateStore.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTemplateStore } from './templateStore'

vi.mock('@/lib/db', () => ({
  executeQuery: vi.fn(),
  executeInsert: vi.fn(),
}))

describe('templateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTemplateStore.setState({ generatedDocs: [] })
  })

  describe('fetchGeneratedDocs', () => {
    it('should fetch and store generated documents', async () => {
      const mockDocs = [
        { id: 1, template_name: 'procuracao', output_filename: 'test.docx', created_at: '2024-01-01' },
      ]

      const { executeQuery } = require('@/lib/db')
      executeQuery.mockResolvedValue(mockDocs)

      await useTemplateStore.getState().fetchGeneratedDocs()

      expect(useTemplateStore.getState().generatedDocs).toEqual(mockDocs)
    })
  })

  describe('logGeneratedDoc', () => {
    it('should insert document record', async () => {
      const { executeInsert } = require('@/lib/db')
      executeInsert.mockResolvedValue(1)

      await useTemplateStore.getState().logGeneratedDoc({
        template_name: 'procuracao',
        client_id: 1,
        case_id: null,
        output_filename: 'test.docx',
        variables_json: '{}',
      })

      expect(executeInsert).toHaveBeenCalled()
    })
  })
})
```

---

### 11.3 Testes para Integracao com Tribunais

#### Arquivo: `src/lib/datajud.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  consultarProcesso,
  extractTribunalFromProcess,
  TRIBUNAIS,
} from './datajud'

global.fetch = vi.fn()

describe('datajud', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('TRIBUNAIS', () => {
    it('should have common Brazilian courts', () => {
      expect(TRIBUNAIS).toHaveProperty('tjsp')
      expect(TRIBUNAIS).toHaveProperty('tjrj')
      expect(TRIBUNAIS).toHaveProperty('stf')
      expect(TRIBUNAIS).toHaveProperty('stj')
    })
  })

  describe('consultarProcesso', () => {
    const mockResponse = {
      hits: {
        total: { value: 1 },
        hits: [{
          _source: {
            numeroProcesso: '1234567890123456789',
            classe: { codigo: 1, nome: 'Acao Civil' },
            orgaoJulgador: { codigo: 1, nome: '1a Vara' },
            movimentos: [
              { nome: 'Distribuido', dataHora: '2024-01-01T10:00:00' },
            ],
          },
        }],
      },
    }

    it('should call DataJud API with correct URL and headers', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await consultarProcesso('1234567-89.2024.8.26.0100', 'tjsp')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': expect.stringContaining('APIKey'),
          }),
        })
      )
    })

    it('should remove non-numeric characters from process number', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await consultarProcesso('1234567-89.2024.8.26.0100', 'tjsp')

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(callBody.query.match.numeroProcesso).toBe('12345678920248260100')
    })

    it('should return null when no results found', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hits: { total: { value: 0 }, hits: [] } }),
      })

      const result = await consultarProcesso('0000000-00.0000.0.00.0000', 'tjsp')

      expect(result).toBeNull()
    })

    it('should return process data when found', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await consultarProcesso('1234567-89.2024.8.26.0100', 'tjsp')

      expect(result).not.toBeNull()
      expect(result?.movimentos).toHaveLength(1)
    })

    it('should throw error on HTTP error', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
      })

      await expect(
        consultarProcesso('1234567-89.2024.8.26.0100', 'tjsp')
      ).rejects.toThrow()
    })

    it('should handle network errors', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      await expect(
        consultarProcesso('1234567-89.2024.8.26.0100', 'tjsp')
      ).rejects.toThrow()
    })
  })

  describe('extractTribunalFromProcess', () => {
    it('should extract TJSP from process number', () => {
      const result = extractTribunalFromProcess('1234567-89.2024.8.26.0100')
      expect(result).toBe('tjsp')
    })

    it('should extract TJRJ from process number', () => {
      const result = extractTribunalFromProcess('1234567-89.2024.8.19.0001')
      expect(result).toBe('tjrj')
    })

    it('should extract TRF3 from process number', () => {
      const result = extractTribunalFromProcess('1234567-89.2024.4.03.6100')
      expect(result).toBe('trf3')
    })

    it('should return null for invalid format', () => {
      const result = extractTribunalFromProcess('invalid-process-number')
      expect(result).toBeNull()
    })

    it('should return null for unknown tribunal', () => {
      const result = extractTribunalFromProcess('1234567-89.2024.8.99.0100')
      expect(result).toBeNull()
    })
  })
})
```

#### Arquivo: `src/stores/movementStore.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMovementStore } from './movementStore'

vi.mock('@/lib/db', () => ({
  executeQuery: vi.fn(),
  executeInsert: vi.fn(),
  executeUpdate: vi.fn(),
}))

vi.mock('@/lib/datajud', () => ({
  consultarProcesso: vi.fn(),
}))

describe('movementStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMovementStore.setState({ movements: [], loading: false })
  })

  describe('fetchMovements', () => {
    it('should fetch movements for a case', async () => {
      const mockMovements = [
        { id: 1, case_id: 1, movement_date: '2024-01-01', description: 'Test', source: 'manual' },
      ]

      const { executeQuery } = require('@/lib/db')
      executeQuery.mockResolvedValue(mockMovements)

      await useMovementStore.getState().fetchMovements(1)

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE case_id = ?'),
        [1]
      )
      expect(useMovementStore.getState().movements).toEqual(mockMovements)
    })
  })

  describe('syncWithDatajud', () => {
    it('should import movements from DataJud', async () => {
      const mockProcesso = {
        movimentos: [
          { nome: 'Distribuido', dataHora: '2024-01-01T10:00:00' },
          { nome: 'Citacao', dataHora: '2024-01-15T14:00:00' },
        ],
      }

      const { consultarProcesso } = require('@/lib/datajud')
      consultarProcesso.mockResolvedValue(mockProcesso)

      const { executeInsert, executeUpdate, executeQuery } = require('@/lib/db')
      executeInsert.mockResolvedValue(1)
      executeUpdate.mockResolvedValue(undefined)
      executeQuery.mockResolvedValue([])

      const count = await useMovementStore.getState().syncWithDatajud(
        1,
        '1234567-89.2024.8.26.0100',
        'tjsp'
      )

      expect(count).toBe(2)
      expect(executeInsert).toHaveBeenCalledTimes(2)
      expect(executeUpdate).toHaveBeenCalled() // Atualiza last_sync
    })

    it('should return 0 when process not found', async () => {
      const { consultarProcesso } = require('@/lib/datajud')
      consultarProcesso.mockResolvedValue(null)

      const count = await useMovementStore.getState().syncWithDatajud(
        1,
        '0000000-00.0000.0.00.0000',
        'tjsp'
      )

      expect(count).toBe(0)
    })

    it('should set loading state during sync', async () => {
      const { consultarProcesso } = require('@/lib/datajud')
      consultarProcesso.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(null), 100)))

      const syncPromise = useMovementStore.getState().syncWithDatajud(1, '123', 'tjsp')

      expect(useMovementStore.getState().loading).toBe(true)

      await syncPromise

      expect(useMovementStore.getState().loading).toBe(false)
    })
  })
})
```

---

### 11.4 Testes para Agenda e Compromissos

#### Arquivo: `src/stores/appointmentStore.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppointmentStore } from './appointmentStore'

vi.mock('@/lib/db', () => ({
  executeQuery: vi.fn(),
  executeInsert: vi.fn(),
  executeUpdate: vi.fn(),
  executeDelete: vi.fn(),
}))

vi.mock('@/lib/activityLogger', () => ({
  logActivity: vi.fn(),
}))

vi.mock('@/lib/autoBackup', () => ({
  triggerBackup: vi.fn(),
}))

describe('appointmentStore', () => {
  const mockAppointment = {
    id: 1,
    title: 'Reuniao com cliente',
    description: 'Discutir caso',
    start_date: '2024-01-15T10:00:00',
    end_date: '2024-01-15T11:00:00',
    location: 'Escritorio',
    type: 'reuniao' as const,
    client_id: 1,
    case_id: null,
    reminder_minutes: 30,
    google_event_id: null,
    created_at: '2024-01-01T00:00:00',
    updated_at: '2024-01-01T00:00:00',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useAppointmentStore.setState({ appointments: [], loading: false })
  })

  describe('fetchAppointments', () => {
    it('should fetch all appointments', async () => {
      const { executeQuery } = require('@/lib/db')
      executeQuery.mockResolvedValue([mockAppointment])

      await useAppointmentStore.getState().fetchAppointments()

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM appointments')
      )
      expect(useAppointmentStore.getState().appointments).toHaveLength(1)
    })

    it('should set loading state', async () => {
      const { executeQuery } = require('@/lib/db')
      executeQuery.mockImplementation(() => new Promise(r => setTimeout(() => r([]), 100)))

      const fetchPromise = useAppointmentStore.getState().fetchAppointments()
      expect(useAppointmentStore.getState().loading).toBe(true)

      await fetchPromise
      expect(useAppointmentStore.getState().loading).toBe(false)
    })
  })

  describe('getAppointmentsByDate', () => {
    it('should filter appointments by date', () => {
      useAppointmentStore.setState({ appointments: [mockAppointment] })

      const date = new Date('2024-01-15')
      const result = useAppointmentStore.getState().getAppointmentsByDate(date)

      expect(result).toHaveLength(1)
    })

    it('should return empty for different date', () => {
      useAppointmentStore.setState({ appointments: [mockAppointment] })

      const date = new Date('2024-02-01')
      const result = useAppointmentStore.getState().getAppointmentsByDate(date)

      expect(result).toHaveLength(0)
    })
  })

  describe('createAppointment', () => {
    it('should insert new appointment and trigger backup', async () => {
      const { executeInsert, executeQuery } = require('@/lib/db')
      const { logActivity } = require('@/lib/activityLogger')
      const { triggerBackup } = require('@/lib/autoBackup')

      executeInsert.mockResolvedValue(1)
      executeQuery.mockResolvedValue([])

      const newAppointment = {
        title: 'Nova Reuniao',
        description: null,
        start_date: '2024-02-01T10:00:00',
        end_date: null,
        location: null,
        type: 'reuniao' as const,
        client_id: null,
        case_id: null,
        reminder_minutes: 30,
        google_event_id: null,
      }

      const id = await useAppointmentStore.getState().createAppointment(newAppointment)

      expect(id).toBe(1)
      expect(executeInsert).toHaveBeenCalled()
      expect(logActivity).toHaveBeenCalledWith('appointment', 1, 'create', expect.any(String))
      expect(triggerBackup).toHaveBeenCalled()
    })
  })

  describe('updateAppointment', () => {
    it('should update appointment fields', async () => {
      const { executeUpdate, executeQuery } = require('@/lib/db')
      executeUpdate.mockResolvedValue(undefined)
      executeQuery.mockResolvedValue([])

      await useAppointmentStore.getState().updateAppointment(1, { title: 'Updated' })

      expect(executeUpdate).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE appointments'),
        expect.arrayContaining(['Updated', 1])
      )
    })
  })

  describe('deleteAppointment', () => {
    it('should delete appointment and update state', async () => {
      useAppointmentStore.setState({ appointments: [mockAppointment] })

      const { executeDelete } = require('@/lib/db')
      const { logActivity } = require('@/lib/activityLogger')
      executeDelete.mockResolvedValue(undefined)

      await useAppointmentStore.getState().deleteAppointment(1)

      expect(executeDelete).toHaveBeenCalled()
      expect(logActivity).toHaveBeenCalledWith('appointment', 1, 'delete', expect.any(String))
      expect(useAppointmentStore.getState().appointments).toHaveLength(0)
    })
  })
})
```

#### Arquivo: `src/components/appointments/AppointmentForm.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AppointmentForm } from './AppointmentForm'

vi.mock('@/stores/appointmentStore', () => ({
  useAppointmentStore: () => ({
    createAppointment: vi.fn().mockResolvedValue(1),
    updateAppointment: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/stores/clientStore', () => ({
  useClientStore: () => ({ clients: [] }),
}))

vi.mock('@/stores/caseStore', () => ({
  useCaseStore: () => ({ cases: [] }),
}))

describe('AppointmentForm', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render form fields', () => {
    render(<AppointmentForm onClose={mockOnClose} />)

    expect(screen.getByLabelText(/titulo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/inicio/i)).toBeInTheDocument()
    expect(screen.getByText(/salvar/i)).toBeInTheDocument()
  })

  it('should show "Novo Compromisso" title for new appointment', () => {
    render(<AppointmentForm onClose={mockOnClose} />)

    expect(screen.getByText('Novo Compromisso')).toBeInTheDocument()
  })

  it('should show "Editar Compromisso" title when editing', () => {
    const appointment = {
      id: 1,
      title: 'Test',
      start_date: '2024-01-15T10:00',
      type: 'reuniao',
    } as any

    render(<AppointmentForm appointment={appointment} onClose={mockOnClose} />)

    expect(screen.getByText('Editar Compromisso')).toBeInTheDocument()
  })

  it('should call onClose when cancel button clicked', () => {
    render(<AppointmentForm onClose={mockOnClose} />)

    fireEvent.click(screen.getByText('Cancelar'))

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should disable submit when title is empty', () => {
    render(<AppointmentForm onClose={mockOnClose} />)

    const submitButton = screen.getByText('Salvar')
    expect(submitButton).toBeDisabled()
  })

  it('should render appointment type buttons', () => {
    render(<AppointmentForm onClose={mockOnClose} />)

    expect(screen.getByText('Reuniao')).toBeInTheDocument()
    expect(screen.getByText('Audiencia')).toBeInTheDocument()
    expect(screen.getByText('Compromisso')).toBeInTheDocument()
    expect(screen.getByText('Outro')).toBeInTheDocument()
  })

  it('should pre-fill form with initial date', () => {
    const initialDate = new Date('2024-03-15T14:00:00')
    render(<AppointmentForm onClose={mockOnClose} initialDate={initialDate} />)

    const dateInput = screen.getByLabelText(/inicio/i) as HTMLInputElement
    expect(dateInput.value).toContain('2024-03-15')
  })
})
```

---

### 11.5 Testes para Controle Financeiro

#### Arquivo: `src/stores/financialStore.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFinancialStore } from './financialStore'

vi.mock('@/lib/db', () => ({
  executeQuery: vi.fn(),
  executeInsert: vi.fn(),
  executeUpdate: vi.fn(),
  executeDelete: vi.fn(),
}))

vi.mock('@/lib/activityLogger', () => ({
  logActivity: vi.fn(),
}))

vi.mock('@/lib/autoBackup', () => ({
  triggerBackup: vi.fn(),
}))

describe('financialStore', () => {
  const mockEntries = [
    {
      id: 1,
      client_id: 1,
      case_id: null,
      type: 'honorario',
      description: 'Honorarios iniciais',
      amount: 5000,
      due_date: '2024-01-15',
      paid_date: '2024-01-10',
      status: 'pago',
      created_at: '2024-01-01',
    },
    {
      id: 2,
      client_id: 1,
      case_id: 1,
      type: 'honorario',
      description: 'Parcela 2',
      amount: 3000,
      due_date: '2024-02-15',
      paid_date: null,
      status: 'pendente',
      created_at: '2024-01-01',
    },
    {
      id: 3,
      client_id: 2,
      case_id: null,
      type: 'despesa',
      description: 'Custas processuais',
      amount: 500,
      due_date: null,
      paid_date: '2024-01-05',
      status: 'pago',
      created_at: '2024-01-01',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useFinancialStore.setState({ entries: [], loading: false })
  })

  describe('fetchEntries', () => {
    it('should fetch all financial entries', async () => {
      const { executeQuery } = require('@/lib/db')
      executeQuery.mockResolvedValue(mockEntries)

      await useFinancialStore.getState().fetchEntries()

      expect(useFinancialStore.getState().entries).toHaveLength(3)
    })
  })

  describe('getEntriesByClient', () => {
    it('should filter entries by client id', () => {
      useFinancialStore.setState({ entries: mockEntries as any })

      const result = useFinancialStore.getState().getEntriesByClient(1)

      expect(result).toHaveLength(2)
      expect(result.every(e => e.client_id === 1)).toBe(true)
    })
  })

  describe('getSummary', () => {
    it('should calculate correct totals', () => {
      useFinancialStore.setState({ entries: mockEntries as any })

      const summary = useFinancialStore.getState().getSummary()

      expect(summary.totalReceived).toBe(5000) // honorario pago
      expect(summary.totalPending).toBe(3000) // honorario pendente
      expect(summary.totalExpenses).toBe(500) // despesa paga
    })

    it('should calculate overdue correctly', () => {
      // Criar entrada vencida
      const overdueEntry = {
        ...mockEntries[1],
        due_date: '2020-01-01', // Data no passado
      }
      useFinancialStore.setState({ entries: [overdueEntry] as any })

      const summary = useFinancialStore.getState().getSummary()

      expect(summary.totalOverdue).toBe(3000)
    })

    it('should return zeros for empty entries', () => {
      useFinancialStore.setState({ entries: [] })

      const summary = useFinancialStore.getState().getSummary()

      expect(summary.totalReceived).toBe(0)
      expect(summary.totalPending).toBe(0)
      expect(summary.totalOverdue).toBe(0)
      expect(summary.totalExpenses).toBe(0)
    })
  })

  describe('getSummaryByClient', () => {
    it('should calculate totals for specific client', () => {
      useFinancialStore.setState({ entries: mockEntries as any })

      const summary = useFinancialStore.getState().getSummaryByClient(1)

      expect(summary.totalReceived).toBe(5000)
      expect(summary.totalPending).toBe(3000)
    })
  })

  describe('createEntry', () => {
    it('should create new entry and trigger backup', async () => {
      const { executeInsert, executeQuery } = require('@/lib/db')
      const { triggerBackup } = require('@/lib/autoBackup')

      executeInsert.mockResolvedValue(4)
      executeQuery.mockResolvedValue([])

      const newEntry = {
        client_id: 1,
        case_id: null,
        type: 'honorario' as const,
        description: 'Novo honorario',
        amount: 2000,
        due_date: '2024-03-01',
        paid_date: null,
        status: 'pendente' as const,
        payment_method: null,
        notes: null,
      }

      const id = await useFinancialStore.getState().createEntry(newEntry)

      expect(id).toBe(4)
      expect(executeInsert).toHaveBeenCalled()
      expect(triggerBackup).toHaveBeenCalled()
    })
  })

  describe('markAsPaid', () => {
    it('should update status to pago and set paid_date', async () => {
      const { executeUpdate, executeQuery } = require('@/lib/db')
      executeUpdate.mockResolvedValue(undefined)
      executeQuery.mockResolvedValue([])

      await useFinancialStore.getState().markAsPaid(2)

      expect(executeUpdate).toHaveBeenCalledWith(
        expect.stringContaining("status = ?"),
        expect.arrayContaining(['pago'])
      )
    })

    it('should use custom paid date when provided', async () => {
      const { executeUpdate, executeQuery } = require('@/lib/db')
      executeUpdate.mockResolvedValue(undefined)
      executeQuery.mockResolvedValue([])

      await useFinancialStore.getState().markAsPaid(2, '2024-02-20')

      expect(executeUpdate).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['pago', '2024-02-20', 2])
      )
    })
  })

  describe('deleteEntry', () => {
    it('should delete entry and update state', async () => {
      useFinancialStore.setState({ entries: mockEntries as any })

      const { executeDelete } = require('@/lib/db')
      executeDelete.mockResolvedValue(undefined)

      await useFinancialStore.getState().deleteEntry(1)

      expect(executeDelete).toHaveBeenCalled()
      expect(useFinancialStore.getState().entries).toHaveLength(2)
    })
  })
})
```

#### Arquivo: `src/pages/Financial.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Financial from './Financial'

vi.mock('@/stores/financialStore', () => ({
  useFinancialStore: () => ({
    entries: [
      { id: 1, client_id: 1, type: 'honorario', description: 'Test', amount: 1000, status: 'pendente', due_date: '2024-01-15' },
    ],
    loading: false,
    fetchEntries: vi.fn(),
    getSummary: () => ({
      totalReceived: 5000,
      totalPending: 3000,
      totalOverdue: 1000,
      totalExpenses: 500,
    }),
    markAsPaid: vi.fn(),
  }),
}))

vi.mock('@/stores/clientStore', () => ({
  useClientStore: () => ({
    clients: [{ id: 1, name: 'Cliente Teste' }],
  }),
}))

describe('Financial Page', () => {
  it('should render page title', () => {
    render(<Financial />)

    expect(screen.getByText('Financeiro')).toBeInTheDocument()
  })

  it('should render summary cards', () => {
    render(<Financial />)

    expect(screen.getByText('Recebido')).toBeInTheDocument()
    expect(screen.getByText('A Receber')).toBeInTheDocument()
    expect(screen.getByText('Atrasado')).toBeInTheDocument()
    expect(screen.getByText('Despesas')).toBeInTheDocument()
  })

  it('should format currency values correctly', () => {
    render(<Financial />)

    // R$ 5.000,00 para totalReceived
    expect(screen.getByText(/R\$\s*5\.000,00/)).toBeInTheDocument()
  })

  it('should render entries in table', () => {
    render(<Financial />)

    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText('Cliente Teste')).toBeInTheDocument()
  })

  it('should have filter selects', () => {
    render(<Financial />)

    expect(screen.getByText('Todos os status')).toBeInTheDocument()
    expect(screen.getByText('Todos os tipos')).toBeInTheDocument()
  })

  it('should have button to add new entry', () => {
    render(<Financial />)

    expect(screen.getByText('Novo Lancamento')).toBeInTheDocument()
  })

  it('should show mark as paid button for pending entries', () => {
    render(<Financial />)

    // O botao de marcar como pago deve estar presente para entradas pendentes
    const checkButtons = screen.getAllByTitle('Marcar como pago')
    expect(checkButtons.length).toBeGreaterThan(0)
  })
})
```

---

### 11.6 Checklist de Testes por Funcionalidade

| Funcionalidade | Testes Unitarios | Testes de Store | Testes de Componente | Minimo |
|----------------|------------------|-----------------|----------------------|--------|
| **Exportacao Excel** | `exportExcel.test.ts` | - | - | 8 testes |
| **Exportacao PDF** | `exportPdf.test.ts` | - | `ClientReport.test.tsx` | 5 testes |
| **Templates DOCX** | `documentTemplates.test.ts` | `templateStore.test.ts` | - | 12 testes |
| **DataJud** | `datajud.test.ts` | `movementStore.test.ts` | - | 15 testes |
| **Agenda** | - | `appointmentStore.test.ts` | `AppointmentForm.test.tsx` | 15 testes |
| **Financeiro** | - | `financialStore.test.ts` | `Financial.test.tsx` | 18 testes |

**Total minimo de testes para v2.0:** ~73 testes novos

---

### 11.7 Comandos de Teste

```bash
# Executar todos os testes
npm test

# Executar testes de uma funcionalidade especifica
npm test -- src/lib/exportExcel.test.ts
npm test -- src/lib/datajud.test.ts
npm test -- src/stores/financialStore.test.ts

# Executar testes com coverage
npm test -- --coverage

# Executar testes em modo watch durante desenvolvimento
npm run test:watch

# Executar apenas testes novos (v2.0)
npm test -- --grep "exportExcel|exportPdf|documentTemplates|datajud|appointmentStore|financialStore"
```

---

### 11.8 Criterios de Aceitacao

Uma funcionalidade so sera considerada **completa** quando:

1. **Cobertura minima de 80%** nos arquivos novos
2. **Todos os testes passando** sem falhas
3. **Casos de borda testados:**
   - Listas vazias
   - Valores nulos/undefined
   - Erros de rede (para APIs)
   - Entradas invalidas
4. **Mocks adequados** para dependencias externas (fetch, bibliotecas de terceiros)
5. **Testes de integracao** para stores que dependem de multiplas fontes

---

## 9. Fontes e Referencias

### Bibliotecas
- [SheetJS Documentation](https://docs.sheetjs.com/docs/demos/frontend/react/)
- [@react-pdf/renderer](https://react-pdf.org/)
- [docxtemplater](https://docxtemplater.com/)
- [react-google-calendar-api](https://www.npmjs.com/package/react-google-calendar-api)

### APIs de Tribunais
- [INTIMA.AI](https://intima.ai/) - API comercial completa
- [Judit.io](https://judit.io/) - Base de dados juridica
- [API Publica DataJud CNJ](https://www.cnj.jus.br/sistemas/datajud/api-publica/)

### Tutoriais
- [Gerando PDFs em React](https://blog.logrocket.com/generating-pdfs-react/)
- [Exportando para Excel com SheetJS](https://docs.sheetjs.com/docs/getting-started/examples/export/)
- [Google Calendar API OAuth2](https://developers.google.com/identity/protocols/oauth2)
