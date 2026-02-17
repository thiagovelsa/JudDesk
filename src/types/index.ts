export interface Client {
  id: number
  name: string
  cpf_cnpj: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Case {
  id: number
  client_id: number
  title: string
  case_number: string | null
  court: string | null
  type: string | null
  status: 'ativo' | 'arquivado' | 'suspenso'
  description: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: number
  case_id: number | null
  client_id: number
  name: string
  file_path: string
  extracted_text: string | null
  folder_id: number | null
  created_at: string
  updated_at: string
}

export interface Deadline {
  id: number
  case_id: number | null
  client_id: number | null
  title: string
  description: string | null
  due_date: string
  reminder_date: string | null
  completed: boolean
  priority: 'baixa' | 'normal' | 'alta' | 'urgente'
  created_at: string
}

export type AIProvider = 'ollama' | 'claude' | 'openai' | 'gemini'

export interface ChatSession {
  id: number
  case_id: number | null
  title: string | null
  provider: AIProvider
  model: string | null
  created_at: string
}

export interface ChatMessage {
  id: number
  session_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface ChatAttachment {
  id: number
  session_id: number
  name: string
  file_path: string | null
  file_type: string
  extracted_text: string | null
  size_bytes: number | null
  error: string | null
  created_at: string
}

export interface OllamaModel {
  name: string
  size: number
  modified_at: string
}

export interface Settings {
  [key: string]: string | null
}

// Activity Log types
export type EntityType = 'client' | 'case' | 'document' | 'deadline'
export type ActionType = 'create' | 'update' | 'delete'

export interface ActivityLog {
  id: number
  entity_type: EntityType
  entity_id: number
  action: ActionType
  entity_name: string | null
  details: string | null
  created_at: string
}

// Document Folder types
export interface DocumentFolder {
  id: number
  name: string
  parent_id: number | null
  case_id: number | null
  client_id: number | null
  position: number
  created_at: string
  children?: DocumentFolder[]
}

// Search Result type
export interface SearchResult {
  type: EntityType
  id: number
  title: string
  subtitle: string
}

// AI Usage Log type
export interface AIUsageLog {
  id: number
  session_id: number | null
  input_tokens: number
  output_tokens: number
  thinking_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cost_usd: number
  created_at: string
}
