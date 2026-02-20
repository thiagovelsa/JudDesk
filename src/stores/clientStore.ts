import { create } from 'zustand'
import { executeQuery, executeInsert, executeUpdate, executeDelete } from '@/lib/db'
import { logActivity } from '@/lib/activityLogger'
import { triggerBackup } from '@/lib/autoBackup'
import { getErrorMessage } from '@/lib/errorUtils'
import { ensureClientDocumentDir, removeClientDocumentDirIfEmpty, removeStoredDocumentFile } from '@/lib/documentStorage'
import { useFolderStore } from './folderStore'
import { useCaseStore } from './caseStore'
import { cleanupAfterClientDelete } from './cascadeCleanup'
import type { Client } from '@/types'

let fetchClientsInFlight: Promise<void> | null = null

interface ClientInput {
  name: string
  cpf_cnpj?: string
  email?: string
  phone?: string
  address?: string
  notes?: string
}

/**
 * Options for creating a client with callbacks for side effects.
 * This pattern decouples the clientStore from other stores.
 */
export interface CreateClientOptions {
  /** Called after client is created, for creating associated folders */
  onClientCreated?: (clientId: number, clientName: string) => Promise<void>
}

interface ClientStore {
  clients: Client[]
  loading: boolean
  error: string | null

  fetchClients: () => Promise<void>
  getClient: (id: number) => Promise<Client | null>
  createClient: (data: ClientInput, options?: CreateClientOptions) => Promise<Client>
  updateClient: (id: number, data: Partial<ClientInput>) => Promise<void>
  deleteClient: (id: number) => Promise<void>
  searchClients: (query: string) => Promise<void>
}

export const useClientStore = create<ClientStore>((set, get) => ({
  clients: [],
  loading: false,
  error: null,

  fetchClients: async () => {
    if (fetchClientsInFlight) {
      return fetchClientsInFlight
    }

    fetchClientsInFlight = (async () => {
      set({ loading: true, error: null })
      try {
        const clients = await executeQuery<Client>(
          'SELECT * FROM clients ORDER BY created_at DESC'
        )
        set({ clients, loading: false })
      } catch (error) {
        set({ error: getErrorMessage(error), loading: false })
      } finally {
        fetchClientsInFlight = null
      }
    })()

    return fetchClientsInFlight
  },

  getClient: async (id: number) => {
    try {
      const clients = await executeQuery<Client>(
        'SELECT * FROM clients WHERE id = ?',
        [id]
      )
      return clients[0] || null
    } catch (error) {
      set({ error: getErrorMessage(error) })
      return null
    }
  },

  createClient: async (data: ClientInput, options?: CreateClientOptions) => {
    set({ loading: true, error: null })
    try {
      const id = await executeInsert(
        `INSERT INTO clients (name, cpf_cnpj, email, phone, address, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          data.cpf_cnpj || null,
          data.email || null,
          data.phone || null,
          data.address || null,
          data.notes || null,
        ]
      )

      const clients = await executeQuery<Client>(
        'SELECT * FROM clients WHERE id = ?',
        [id]
      )
      const newClient = clients[0]

      set((state) => ({
        clients: [newClient, ...state.clients],
        loading: false,
      }))

      // Create folder for the client automatically (via callback for decoupling)
      if (options?.onClientCreated) {
        try {
          await options.onClientCreated(newClient.id, newClient.name)
        } catch (folderError) {
          console.error('[ClientStore] Failed to create client folder:', folderError)
          // Don't throw - client was created successfully, folder is optional
        }
      }

      // Ensure filesystem directory for client documents
      try {
        await ensureClientDocumentDir(newClient.id)
      } catch (dirError) {
        console.error('[ClientStore] Failed to create client document directory:', dirError)
      }

      // Log activity
      await logActivity('client', newClient.id, 'create', newClient.name)
      triggerBackup()

      return newClient
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateClient: async (id: number, data: Partial<ClientInput>) => {
    set({ loading: true, error: null })
    try {
      const fields: string[] = []
      const values: unknown[] = []

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = ?`)
          values.push(value)
        }
      })

      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP')
        values.push(id)

        await executeUpdate(
          `UPDATE clients SET ${fields.join(', ')} WHERE id = ?`,
          values
        )

        // Sync folder name if client name changed
        if (data.name) {
          try {
            const clientFolder = await useFolderStore.getState().getClientFolder(id)
            if (clientFolder) {
              await useFolderStore.getState().renameFolder(clientFolder.id, data.name)
            }
          } catch (folderError) {
            console.error('[ClientStore] Failed to sync folder name:', folderError)
            // Don't throw - client was updated successfully, folder sync is optional
          }
        }

        // Fetch only the updated client instead of all clients
        const updated = await executeQuery<Client>(
          'SELECT * FROM clients WHERE id = ?',
          [id]
        )

        if (updated[0]) {
          // Patch the client in local state
          set((state) => ({
            clients: state.clients.map((c) =>
              c.id === id ? updated[0] : c
            ),
            loading: false,
          }))

          // Log activity with changed fields
          await logActivity('client', id, 'update', updated[0].name, data)
        } else {
          set({ loading: false })
        }

        triggerBackup()
      } else {
        set({ loading: false })
      }
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  deleteClient: async (id: number) => {
    set({ loading: true, error: null })
    try {
      // Get client name before deletion for logging
      const client = await get().getClient(id)
      const clientName = client?.name
      const clientDocumentPaths = await executeQuery<{ file_path: string }>(
        `SELECT file_path FROM documents
         WHERE client_id = ? AND file_path IS NOT NULL AND file_path != ''`,
        [id]
      )
      const clientCases = await executeQuery<{ id: number }>(
        'SELECT id FROM cases WHERE client_id = ?',
        [id]
      )
      const caseIdsToRemove = new Set(clientCases.map((row) => row.id))

      await executeDelete('DELETE FROM clients WHERE id = ?', [id])
      await executeDelete('DELETE FROM document_folders WHERE client_id = ?', [id])

      // Best-effort cleanup of local files linked to this client's documents.
      await Promise.allSettled(
        clientDocumentPaths.map((row) => removeStoredDocumentFile(row.file_path))
      )
      await removeClientDocumentDirIfEmpty(id)

      set((state) => ({
        clients: state.clients.filter((c) => c.id !== id),
        loading: false,
      }))

      // Keep case store in sync
      useCaseStore.setState((state) => ({
        cases: state.cases.filter((c) => c.client_id !== id),
      }))

      const cleanupResult = await cleanupAfterClientDelete(id, Array.from(caseIdsToRemove))
      if (!cleanupResult.ok) {
        console.warn('[ClientStore] Partial cleanup after deleteClient:', cleanupResult.warnings)
      }

      // Log activity
      await logActivity('client', id, 'delete', clientName)
      triggerBackup()
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  searchClients: async (query: string) => {
    set({ loading: true, error: null })
    try {
      const searchTerm = `%${query}%`
      const clients = await executeQuery<Client>(
        `SELECT * FROM clients
         WHERE name LIKE ? OR cpf_cnpj LIKE ? OR email LIKE ?
         ORDER BY created_at DESC`,
        [searchTerm, searchTerm, searchTerm]
      )
      set({ clients, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },
}))
