import { describe, it, expect, beforeEach } from 'vitest'
import { useClientStore } from './clientStore'
import { mockDatabase, resetMocks, mockDatabaseSelect, mockDatabaseExecute } from '@/test/setup'
import type { Client } from '@/types'

describe('clientStore', () => {
  beforeEach(() => {
    resetMocks()
    // Reset store state
    useClientStore.setState({
      clients: [],
      loading: false,
      error: null,
    })
  })

  describe('fetchClients', () => {
    it('should fetch clients from database', async () => {
      const mockClients: Client[] = [
        {
          id: 1,
          name: 'Test Client',
          cpf_cnpj: '12345678901',
          email: 'test@email.com',
          phone: '11999999999',
          address: 'Test Address',
          notes: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockClients)

      await useClientStore.getState().fetchClients()

      const state = useClientStore.getState()
      expect(state.clients).toEqual(mockClients)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM clients ORDER BY created_at DESC',
        []
      )
    })

    it('should handle errors', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Database error'))

      await useClientStore.getState().fetchClients()

      const state = useClientStore.getState()
      expect(state.clients).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBe('Database error')
    })
  })

  describe('getClient', () => {
    it('should get client by id', async () => {
      const mockClient: Client = {
        id: 1,
        name: 'Test Client',
        cpf_cnpj: '12345678901',
        email: 'test@email.com',
        phone: '11999999999',
        address: 'Test Address',
        notes: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseSelect([mockClient])

      const result = await useClientStore.getState().getClient(1)

      expect(result).toEqual(mockClient)
      expect(mockDatabase.select).toHaveBeenCalledWith(
        'SELECT * FROM clients WHERE id = ?',
        [1]
      )
    })

    it('should return null if client not found', async () => {
      mockDatabaseSelect([])

      const result = await useClientStore.getState().getClient(999)

      expect(result).toBeNull()
    })
  })

  describe('createClient', () => {
    it('should create a new client', async () => {
      const newClient = {
        name: 'New Client',
        cpf_cnpj: '98765432100',
        email: 'new@email.com',
        phone: '21988888888',
        address: 'New Address',
        notes: 'Some notes',
      }

      const createdClient: Client = {
        id: 1,
        ...newClient,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      mockDatabaseExecute(1, 1)
      mockDatabase.select.mockResolvedValueOnce([createdClient])

      const result = await useClientStore.getState().createClient(newClient)

      expect(result).toEqual(createdClient)
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO clients'),
        [
          newClient.name,
          newClient.cpf_cnpj,
          newClient.email,
          newClient.phone,
          newClient.address,
          newClient.notes,
        ]
      )

      const state = useClientStore.getState()
      expect(state.clients).toContainEqual(createdClient)
    })

    it('should handle creation errors', async () => {
      mockDatabase.execute.mockRejectedValue(new Error('Insert failed'))

      await expect(
        useClientStore.getState().createClient({ name: 'Test' })
      ).rejects.toThrow('Insert failed')

      const state = useClientStore.getState()
      expect(state.error).toBe('Insert failed')
    })
  })

  describe('updateClient', () => {
    it('should update an existing client', async () => {
      const updatedClients: Client[] = [
        {
          id: 1,
          name: 'Updated Name',
          cpf_cnpj: '12345678901',
          email: 'updated@email.com',
          phone: '11999999999',
          address: 'Test Address',
          notes: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ]

      mockDatabaseExecute(0, 1)
      mockDatabase.select.mockResolvedValueOnce(updatedClients)

      await useClientStore.getState().updateClient(1, {
        name: 'Updated Name',
        email: 'updated@email.com',
      })

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE clients SET'),
        expect.arrayContaining(['Updated Name', 'updated@email.com', 1])
      )
    })

    it('should not execute if no fields to update', async () => {
      mockDatabase.select.mockResolvedValueOnce([])

      await useClientStore.getState().updateClient(1, {})

      expect(mockDatabase.execute).not.toHaveBeenCalled()
    })
  })

  describe('deleteClient', () => {
    it('should delete a client', async () => {
      useClientStore.setState({
        clients: [
          {
            id: 1,
            name: 'Test',
            cpf_cnpj: null,
            email: null,
            phone: null,
            address: null,
            notes: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      })

      mockDatabaseExecute(0, 1)

      await useClientStore.getState().deleteClient(1)

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'DELETE FROM clients WHERE id = ?',
        [1]
      )

      const state = useClientStore.getState()
      expect(state.clients).toHaveLength(0)
    })
  })

  describe('searchClients', () => {
    it('should search clients by name, cpf/cnpj or email', async () => {
      const mockResults: Client[] = [
        {
          id: 1,
          name: 'Test Client',
          cpf_cnpj: '12345678901',
          email: 'test@email.com',
          phone: null,
          address: null,
          notes: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockDatabaseSelect(mockResults)

      await useClientStore.getState().searchClients('test')

      expect(mockDatabase.select).toHaveBeenCalledWith(
        expect.stringContaining('WHERE name LIKE ?'),
        ['%test%', '%test%', '%test%']
      )

      const state = useClientStore.getState()
      expect(state.clients).toEqual(mockResults)
    })

    it('should handle errors in searchClients', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Search failed'))

      await useClientStore.getState().searchClients('test')

      const state = useClientStore.getState()
      expect(state.error).toBe('Search failed')
      expect(state.loading).toBe(false)
    })
  })

  describe('updateClient error handling', () => {
    it('should throw and set error on database error', async () => {
      mockDatabase.execute.mockRejectedValue(new Error('Update failed'))

      await expect(
        useClientStore.getState().updateClient(1, { name: 'New Name' })
      ).rejects.toThrow('Update failed')

      const state = useClientStore.getState()
      expect(state.error).toBe('Update failed')
      expect(state.loading).toBe(false)
    })
  })

  describe('deleteClient error handling', () => {
    it('should throw and set error on database error', async () => {
      // First mock getClient to return a client
      mockDatabase.select.mockResolvedValueOnce([{ id: 1, name: 'Test' }])
      // Then mock delete to fail
      mockDatabase.execute.mockRejectedValue(new Error('Delete failed'))

      await expect(
        useClientStore.getState().deleteClient(1)
      ).rejects.toThrow('Delete failed')

      const state = useClientStore.getState()
      expect(state.error).toBe('Delete failed')
      expect(state.loading).toBe(false)
    })
  })

  describe('getClient error handling', () => {
    it('should set error and return null on database error', async () => {
      mockDatabase.select.mockRejectedValue(new Error('Connection lost'))

      const result = await useClientStore.getState().getClient(1)

      expect(result).toBeNull()
      const state = useClientStore.getState()
      expect(state.error).toBe('Connection lost')
    })
  })
})
