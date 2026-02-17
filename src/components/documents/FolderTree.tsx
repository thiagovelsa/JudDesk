import { useState, useEffect, useRef } from 'react'
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderPlus,
  User,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useFolderStore } from '@/stores/folderStore'
import type { DocumentFolder } from '@/types'
import { cn } from '@/lib/utils'

interface FolderTreeProps {
  onSelectFolder: (folderId: number | null) => void
  selectedFolderId: number | null
}

interface FolderItemProps {
  folder: DocumentFolder
  level: number
  selectedId: number | null
  onSelect: (id: number | null) => void
  onCloseAllMenus: () => void
  openMenuId: number | null
  onOpenMenu: (id: number) => void
}

function FolderItem({ folder, level, selectedId, onSelect, onCloseAllMenus, openMenuId, onOpenMenu }: FolderItemProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(folder.name)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    expandedIds,
    toggleExpanded,
    renameFolder,
    deleteFolder,
    createFolder,
  } = useFolderStore()

  const isExpanded = expandedIds.has(folder.id)
  const hasChildren = folder.children && folder.children.length > 0
  const isSelected = selectedId === folder.id
  const showMenu = openMenuId === folder.id

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  const handleRename = async () => {
    if (newName.trim() && newName !== folder.name) {
      await renameFolder(folder.id, newName.trim())
    }
    setIsRenaming(false)
  }

  const handleDelete = async () => {
    if (confirm(`Excluir pasta "${folder.name}"? Esta ação excluirá também todas as subpastas.`)) {
      await deleteFolder(folder.id)
    }
    onCloseAllMenus()
  }

  const handleCreateSubfolder = async () => {
    const name = prompt('Nome da nova pasta:')
    if (name?.trim()) {
      await createFolder(name.trim(), folder.id)
    }
    onCloseAllMenus()
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
          isSelected
            ? 'bg-primary/20 text-primary'
            : 'text-gray-400 hover:bg-surface-dark hover:text-white',
          isDragging && 'opacity-50'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(folder.id)}
        {...attributes}
        {...listeners}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) toggleExpanded(folder.id)
          }}
          className={cn(
            'p-0.5 rounded transition-colors',
            hasChildren
              ? 'hover:bg-surface-highlight'
              : 'opacity-0 pointer-events-none'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>

        {/* Folder Icon - User icon for client folders */}
        {folder.client_id ? (
          <User className="size-4 shrink-0 text-blue-400" />
        ) : isExpanded && hasChildren ? (
          <FolderOpen className="size-4 shrink-0" />
        ) : (
          <Folder className="size-4 shrink-0" />
        )}

        {/* Name */}
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') {
                setNewName(folder.name)
                setIsRenaming(false)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 px-1 py-0.5 bg-surface-highlight border border-primary rounded text-sm text-white focus:outline-none min-w-0"
          />
        ) : (
          <span className="flex-1 truncate text-sm">{folder.name}</span>
        )}

        {/* Menu Button */}
        <div className="relative" ref={menuRef} data-folder-menu>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (showMenu) {
                onCloseAllMenus()
              } else {
                onOpenMenu(folder.id)
              }
            }}
            className={cn(
              'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
              'hover:bg-surface-highlight'
            )}
          >
            <MoreHorizontal className="size-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-background-dark border border-border-dark rounded-lg shadow-xl z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsRenaming(true)
                  onCloseAllMenus()
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:bg-surface-dark hover:text-white transition-colors rounded-t-lg"
              >
                <Pencil className="size-4" />
                Renomear
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCreateSubfolder()
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:bg-surface-dark hover:text-white transition-colors"
              >
                <FolderPlus className="size-4" />
                Nova Subpasta
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete()
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors rounded-b-lg"
              >
                <Trash2 className="size-4" />
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <SortableContext
          items={folder.children!.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {folder.children!.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onCloseAllMenus={onCloseAllMenus}
              openMenuId={openMenuId}
              onOpenMenu={onOpenMenu}
            />
          ))}
        </SortableContext>
      )}
    </div>
  )
}

export default function FolderTree({
  onSelectFolder,
  selectedFolderId,
}: FolderTreeProps) {
  const [activeId, setActiveId] = useState<number | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const {
    fetchFolders,
    getFolderTree,
    createFolder,
    moveFolder,
    loading,
  } = useFolderStore()

  // Single global listener for closing menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside any menu
      const target = e.target as HTMLElement
      if (!target.closest('[data-folder-menu]')) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  const folderTree = getFolderTree()

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const activeFolder = useFolderStore.getState().folders.find(
      (f) => f.id === active.id
    )
    const overFolder = useFolderStore.getState().folders.find(
      (f) => f.id === over.id
    )

    if (activeFolder && overFolder) {
      // Move to be a child of the target folder
      moveFolder(Number(active.id), Number(over.id))
    }
  }

  const handleCreateRootFolder = async () => {
    const name = prompt('Nome da nova pasta:')
    if (name?.trim()) {
      await createFolder(name.trim())
    }
  }

  const activeFolder = activeId
    ? useFolderStore.getState().folders.find((f) => f.id === activeId)
    : null

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="text-sm font-medium text-gray-400">Pastas</h3>
        <button
          onClick={handleCreateRootFolder}
          className="p-1 hover:bg-surface-highlight rounded transition-colors text-gray-400 hover:text-white"
          title="Nova pasta"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-0.5">
          {/* All Documents Option */}
          <button
            onClick={() => onSelectFolder(null)}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors',
              selectedFolderId === null
                ? 'bg-primary/20 text-primary'
                : 'text-gray-400 hover:bg-surface-dark hover:text-white'
            )}
          >
            <Folder className="size-4" />
            Todos
          </button>

          {loading && folderTree.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">Carregando...</div>
          ) : (
            <SortableContext
              items={folderTree.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {folderTree.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  level={0}
                  selectedId={selectedFolderId}
                  onSelect={onSelectFolder}
                  onCloseAllMenus={() => setOpenMenuId(null)}
                  openMenuId={openMenuId}
                  onOpenMenu={setOpenMenuId}
                />
              ))}
            </SortableContext>
          )}
        </div>

        <DragOverlay>
          {activeId && activeFolder && (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-dark border border-primary rounded-lg text-white text-sm shadow-xl">
              {activeFolder.client_id ? (
                <User className="size-4 text-blue-400" />
              ) : (
                <Folder className="size-4 text-primary" />
              )}
              {activeFolder.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
