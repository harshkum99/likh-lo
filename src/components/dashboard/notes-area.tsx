'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createDashboardNote, updateDashboardNote, deleteDashboardNote } from '@/app/dashboard/actions'
import { Plus, Save, Loader2, Trash2, Edit2, X } from 'lucide-react'

interface Note {
  id: string
  content: string
  updated_at: string
}

export function NotesArea({ initialNotes }: { initialNotes: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [isAdding, setIsAdding] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleAddNote() {
    if (!newNoteContent.trim()) return
    setIsSaving(true)
    const result = await createDashboardNote(newNoteContent)
    if (result.success) {
      setNewNoteContent('')
      setIsAdding(false)
      // Note: revalidatePath will refresh the server component, 
      // but for immediate UI feedback we'd usually rely on the server refresh 
      // or optimistic updates. Here we'll just wait for the refresh.
    } else {
      alert('Failed to add note: ' + result.error)
    }
    setIsSaving(false)
  }

  async function handleUpdateNote(id: string) {
    if (!editContent.trim()) return
    setIsSaving(true)
    const result = await updateDashboardNote(id, editContent)
    if (result.success) {
      setEditingId(null)
      setEditContent('')
    } else {
      alert('Failed to update note: ' + result.error)
    }
    setIsSaving(false)
  }

  async function handleDeleteNote(id: string) {
    if (!confirm('Are you sure you want to delete this note?')) return
    const result = await deleteDashboardNote(id)
    if (!result.success) {
      alert('Failed to delete note: ' + result.error)
    }
  }

  function startEditing(note: Note) {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Quick Notes</h2>
        <Button 
          size="sm" 
          variant="ghost" 
          className="h-8 w-8 p-0 rounded-full"
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-5 w-5" />}
        </Button>
      </div>

      {isAdding && (
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
          <CardContent className="p-4 space-y-3">
            <Textarea
              placeholder="Write a new note..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              className="min-h-[100px] bg-zinc-50/50 dark:bg-zinc-800/50 border-none focus-visible:ring-1 focus-visible:ring-zinc-200 resize-none rounded-xl p-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setIsAdding(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                className="bg-[#1a365d] hover:bg-[#2a4a7d] rounded-lg px-4"
                onClick={handleAddNote}
                disabled={isSaving || !newNoteContent.trim()}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Note
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {initialNotes.length === 0 && !isAdding && (
          <p className="text-sm text-zinc-500 text-center py-8">No notes yet. Click + to add one.</p>
        )}
        
        {initialNotes.map((note) => (
          <Card key={note.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 group">
            <CardContent className="p-4">
              {editingId === note.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[100px] bg-zinc-50/50 dark:bg-zinc-800/50 border-none focus-visible:ring-1 focus-visible:ring-zinc-200 resize-none rounded-xl p-3"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setEditingId(null)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-[#1a365d] hover:bg-[#2a4a7d] rounded-lg px-4"
                      onClick={() => handleUpdateNote(note.id)}
                      disabled={isSaving || !editContent.trim()}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                      Update
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                      {note.content}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {new Date(note.updated_at).toLocaleDateString('en-IN', { 
                        day: 'numeric', 
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0"
                      onClick={() => startEditing(note)}
                    >
                      <Edit2 className="h-3.5 w-3.5 text-zinc-400" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
