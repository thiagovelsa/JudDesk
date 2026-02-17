import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useClientStore } from '@/stores/clientStore'
import { useCaseStore } from '@/stores/caseStore'
import { useDeadlineStore } from '@/stores/deadlineStore'
import { mockDatabase, resetMocks, mockDatabaseExecute } from '@/test/setup'

// --- Mock Side Effects ---
vi.mock('@/lib/activityLogger', () => ({
    logActivity: vi.fn(),
}))

vi.mock('@/lib/autoBackup', () => ({
    triggerBackup: vi.fn(),
}))

// --- Mock DB Module to Bypass Environment Check ---
vi.mock('@/lib/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/db')>()
    return {
        ...actual,
        isTauriEnvironment: () => true, // Force True
        getDatabase: async () => {
            // Direct access to the mocked plugin from setup.ts via dynamic import if needed,
            // but simpler to just return the mockDatabase directly if we export it or reuse logic.
            // Actually, let's just make it return a proxy that delegates to our setup mockDatabase.
            // Since setup.ts mocked @tauri-apps/plugin-sql, calling Database.load works!
            const { default: Database } = await import('@tauri-apps/plugin-sql')
            return await Database.load('sqlite:jurisdesk.db')
        }
    }
})

describe('User Workflow Integration', () => {
    beforeEach(() => {
        resetMocks()
        useClientStore.setState({ clients: [], loading: false })
        useCaseStore.setState({ cases: [], loading: false })
        useDeadlineStore.setState({ deadlines: [], loading: false })
        
        // Default mock for folder queries (they're optional and can fail gracefully)
        mockDatabase.select.mockResolvedValue([])
    })

    it('should successfully execute a full robust workflow: Create Client -> Create Case -> Add Deadline', async () => {
        // --- Step 1: Create Client ---
        const newClient = {
            name: 'Dr. Robust Test',
            email: 'robust@test.com',
            phone: '555-0199',
            notes: 'Integration Test Client'
        }

        // Mock client insertion
        mockDatabase.execute.mockResolvedValueOnce({ lastInsertId: 1, rowsAffected: 1 })
        
        // Mock the SELECT query that fetches the newly created client
        const clientData = {
            id: 1,
            name: 'Dr. Robust Test',
            email: 'robust@test.com',
            phone: '555-0199',
            notes: 'Integration Test Client',
            cpf_cnpj: null,
            address: null,
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z'
        }
        mockDatabase.select.mockResolvedValue([clientData])

        const createdClient = await useClientStore.getState().createClient(newClient)
        
        expect(createdClient.id).toBe(1)
        expect(createdClient.name).toBe('Dr. Robust Test')
        expect(useClientStore.getState().clients).toHaveLength(1)

        // --- Step 2: Create Case ---
        const newCase = {
            client_id: createdClient.id,
            title: 'Processo Integrado n.1',
            status: 'ativo' as const,
            description: 'Testing link between client and case'
        }

        // Mock case insertion
        mockDatabase.execute.mockResolvedValueOnce({ lastInsertId: 101, rowsAffected: 1 })
        
        // Mock the SELECT query that fetches the newly created case
        mockDatabase.select
            .mockResolvedValueOnce([{ // SELECT * FROM cases WHERE id = ?
                id: 101,
                client_id: 1,
                title: 'Processo Integrado n.1',
                case_number: null,
                court: null,
                type: null,
                status: 'ativo',
                description: 'Testing link between client and case',
                created_at: '2025-01-02T00:00:00.000Z',
                updated_at: '2025-01-02T00:00:00.000Z'
            }])
            .mockResolvedValue([]) // Subsequent queries return empty

        const createdCase = await useCaseStore.getState().createCase(newCase)
        
        expect(createdCase.id).toBe(101)
        expect(createdCase.title).toBe('Processo Integrado n.1')
        expect(createdCase.client_id).toBe(1)
        expect(useCaseStore.getState().cases).toHaveLength(1)

        // --- Step 3: Add Deadline ---
        const newDeadline = {
            title: 'Audiência Final',
            due_date: '2025-12-31T23:59:00.000Z',
            client_id: createdClient.id,
            case_id: createdCase.id,
            priority: 'alta' as const
        }

        // Mock deadline insertion
        mockDatabase.execute.mockResolvedValueOnce({ lastInsertId: 505, rowsAffected: 1 })
        
        // Mock the SELECT query that fetches the newly created deadline
        mockDatabase.select
            .mockResolvedValueOnce([{ // SELECT * FROM deadlines WHERE id = ?
                id: 505,
                title: 'Audiência Final',
                description: null,
                due_date: '2025-12-31T23:59:00.000Z',
                reminder_date: null,
                completed: 0,
                priority: 'alta',
                client_id: 1,
                case_id: 101,
                created_at: '2025-01-03T00:00:00.000Z'
            }])
            .mockResolvedValue([]) // Subsequent queries return empty

        const createdDeadline = await useDeadlineStore.getState().createDeadline(newDeadline)
        
        expect(createdDeadline.id).toBe(505)
        expect(createdDeadline.title).toBe('Audiência Final')
        expect(createdDeadline.client_id).toBe(1)
        expect(createdDeadline.case_id).toBe(101)
        expect(useDeadlineStore.getState().deadlines).toHaveLength(1)

        // Verify the full workflow chain
        const clients = useClientStore.getState().clients
        const cases = useCaseStore.getState().cases
        const deadlines = useDeadlineStore.getState().deadlines

        expect(clients[0].id).toBe(deadlines[0].client_id)
        expect(cases[0].id).toBe(deadlines[0].case_id)
        expect(cases[0].client_id).toBe(clients[0].id)
    })

    it('should handle workflow with existing data', async () => {
        // Prepopulate with existing client
        useClientStore.setState({
            clients: [{
                id: 10,
                name: 'Existing Client',
                email: 'existing@test.com',
                phone: null,
                cpf_cnpj: null,
                address: null,
                notes: null,
                created_at: '2025-01-01',
                updated_at: '2025-01-01'
            }],
            loading: false
        })

        // Create case for existing client
        const newCase = {
            client_id: 10,
            title: 'New Case for Existing Client',
            status: 'ativo' as const,
            description: 'Test case'
        }

        mockDatabase.execute.mockResolvedValueOnce({ lastInsertId: 200, rowsAffected: 1 })
        mockDatabase.select.mockResolvedValueOnce([{
            id: 200,
            client_id: 10,
            title: 'New Case for Existing Client',
            case_number: null,
            court: null,
            type: null,
            status: 'ativo',
            description: 'Test case',
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z'
        }])

        const createdCase = await useCaseStore.getState().createCase(newCase)

        expect(createdCase.client_id).toBe(10)
        expect(useCaseStore.getState().cases).toHaveLength(1)
    })

    it('should maintain referential integrity in stores', async () => {
        // Create client
        mockDatabase.execute.mockResolvedValueOnce({ lastInsertId: 1, rowsAffected: 1 })
        mockDatabase.select.mockResolvedValueOnce([{
            id: 1,
            name: 'Test Client',
            email: 'test@test.com',
            phone: null,
            cpf_cnpj: null,
            address: null,
            notes: null,
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z'
        }])

        const client = await useClientStore.getState().createClient({
            name: 'Test Client',
            email: 'test@test.com'
        })

        // Create case
        mockDatabase.execute.mockResolvedValueOnce({ lastInsertId: 1, rowsAffected: 1 })
        mockDatabase.select.mockResolvedValueOnce([{
            id: 1,
            client_id: 1,
            title: 'Test Case',
            case_number: null,
            court: null,
            type: null,
            status: 'ativo',
            description: null,
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z'
        }])

        const caseItem = await useCaseStore.getState().createCase({
            client_id: client.id,
            title: 'Test Case',
            status: 'ativo' as const
        })

        // Update case
        mockDatabase.execute.mockResolvedValueOnce({ lastInsertId: 0, rowsAffected: 1 })
        
        // Mock SELECT that fetches the updated case
        mockDatabase.select.mockResolvedValueOnce([{
            id: 1,
            client_id: 1,
            title: 'Updated Case Title', // Updated title
            case_number: null,
            court: null,
            type: null,
            status: 'ativo',
            description: null,
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: new Date().toISOString() // Updated timestamp
        }])
        
        await useCaseStore.getState().updateCase(caseItem.id, {
            title: 'Updated Case Title'
        })

        // The store should have the updated case
        const updatedCase = useCaseStore.getState().cases.find(c => c.id === caseItem.id)
        expect(updatedCase).toBeDefined()
        expect(updatedCase?.title).toBe('Updated Case Title')
        expect(updatedCase?.client_id).toBe(client.id)
        expect(updatedCase?.updated_at).toBeDefined()
    })
})
