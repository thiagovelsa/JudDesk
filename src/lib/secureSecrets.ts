import { invoke } from '@tauri-apps/api/core'
import { isTauriEnvironment } from './db'
import { isSensitiveSettingKey, type SensitiveSettingKey } from './securityConstants'

const KEYCHAIN_SERVICE_NAME = 'jurisdesk'

type SecretMap = Record<SensitiveSettingKey, string | null>

function isKeychainBridgeAvailable(): boolean {
  if (!isTauriEnvironment()) return false
  try {
    const internals = (window as unknown as {
      __TAURI_INTERNALS__?: { invoke?: unknown }
    }).__TAURI_INTERNALS__
    return typeof internals?.invoke === 'function'
  } catch {
    return false
  }
}

function isTestMode(): boolean {
  return Boolean((import.meta as ImportMeta & { env?: Record<string, unknown> }).env?.VITEST)
}

async function getSecret(secretKey: SensitiveSettingKey): Promise<string | null> {
  if (!isTauriEnvironment()) return null
  if (!isKeychainBridgeAvailable()) return null

  const value = await invoke<string | null>('get_secret', {
    service: KEYCHAIN_SERVICE_NAME,
    key: secretKey,
  })

  if (typeof value !== 'string' || !value.trim()) return null
  return value
}

async function setSecret(secretKey: SensitiveSettingKey, value: string): Promise<void> {
  if (!isTauriEnvironment()) return
  if (!isKeychainBridgeAvailable()) {
    if (isTestMode()) return
    throw new Error('Secure keychain bridge unavailable.')
  }

  await invoke('set_secret', {
    service: KEYCHAIN_SERVICE_NAME,
    key: secretKey,
    value,
  })
}

async function deleteSecret(secretKey: SensitiveSettingKey): Promise<void> {
  if (!isTauriEnvironment()) return
  if (!isKeychainBridgeAvailable()) {
    if (isTestMode()) return
    throw new Error('Secure keychain bridge unavailable.')
  }

  await invoke('delete_secret', {
    service: KEYCHAIN_SERVICE_NAME,
    key: secretKey,
  })
}

export async function getSecretForSettingKey(key: SensitiveSettingKey): Promise<string | null> {
  return getSecret(key)
}

export async function setSecretForSettingKey(
  key: SensitiveSettingKey,
  value: string | null
): Promise<void> {
  const trimmedValue = value?.trim() ?? ''
  if (!trimmedValue) {
    await deleteSecret(key)
    return
  }
  await setSecret(key, trimmedValue)
}

export async function getSensitiveSettingsFromKeychain(): Promise<SecretMap> {
  const result: SecretMap = {
    claude_api_key: null,
    openai_api_key: null,
    gemini_api_key: null,
  }

  for (const key of Object.keys(result) as SensitiveSettingKey[]) {
    try {
      result[key] = await getSecretForSettingKey(key)
    } catch (error) {
      console.error(`[Secrets] Failed to read ${key} from keychain:`, error)
      result[key] = null
    }
  }

  return result
}

export async function migrateLegacySensitiveSettings(
  settings: Record<string, string | null>
): Promise<{
  values: SecretMap
  migratedKeys: SensitiveSettingKey[]
}> {
  const values: SecretMap = {
    claude_api_key: null,
    openai_api_key: null,
    gemini_api_key: null,
  }
  const migratedKeys: SensitiveSettingKey[] = []

  if (!isKeychainBridgeAvailable()) {
    for (const key of Object.keys(values) as SensitiveSettingKey[]) {
      const legacyValue = settings[key]
      values[key] = legacyValue?.trim() ? legacyValue : null
    }
    return { values, migratedKeys }
  }

  for (const key of Object.keys(values) as SensitiveSettingKey[]) {
    const keychainValue = await getSecretForSettingKey(key).catch((error) => {
      console.error(`[Secrets] Failed to read ${key} from keychain:`, error)
      return null
    })

    if (keychainValue) {
      values[key] = keychainValue
      continue
    }

    const legacyValue = settings[key]
    if (!legacyValue?.trim()) {
      values[key] = null
      continue
    }

    try {
      await setSecretForSettingKey(key, legacyValue)
      values[key] = legacyValue
      migratedKeys.push(key)
    } catch (error) {
      console.error(`[Secrets] Keychain migration failed for ${key}:`, error)
      values[key] = null
    }
  }

  return { values, migratedKeys }
}

export function isSensitiveKey(key: string): key is SensitiveSettingKey {
  return isSensitiveSettingKey(key)
}
