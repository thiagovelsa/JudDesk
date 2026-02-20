export const SENSITIVE_SETTING_KEYS = new Set([
  'claude_api_key',
  'openai_api_key',
  'gemini_api_key',
] as const)

export type SensitiveSettingKey =
  | 'claude_api_key'
  | 'openai_api_key'
  | 'gemini_api_key'

export function isSensitiveSettingKey(key: string): key is SensitiveSettingKey {
  return SENSITIVE_SETTING_KEYS.has(key as SensitiveSettingKey)
}
