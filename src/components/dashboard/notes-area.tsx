'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { createDashboardNote, deleteDashboardNote, updateDashboardNote } from '@/app/dashboard/actions'
import { Panel, Section } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { confirmDialog } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'

export interface Note {
  id: string
  content: string
  updated_at: string
}

type Change = { type: 'add'; note: Note } | { type: 'update'; id: string; content: string } | { type: 'delete'; id: string }

function applyChange(notes: Note[], c: Change): Note[] {
  if (c.type === 'add') return [c.note, ...notes]
  if (c.type === 'delete') return notes.filter(n => n.id !== c.id)
  return notes.map(n => (n.id === c.id ? { ...n, content: c.content } : n))
}

let tempId = 0
const isTemp = (id: string) => id.startsWith('tmp-')
const INPUT = 'resize-none rounded-xl border-transparent bg-muted/60 px-3.5 py-2.5 field-sizing-content focus-visible:bg-card'

// shortcut: fixed to IST so server and browser render the same text; use the browser's zone if users outside India appear.
function stamp(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** Quick notes. Changes show instantly (useOptimistic) and roll back with a toast if the server rejects them. */
export function NotesArea({ initialNotes }: { initialNotes: Note[] }) {
  const [notes, apply] = useOptimistic(initialNotes, applyChange)
  const [, startTransition] = useTransition()
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null)

  function run(change: Change, action: () => Promise<{ success: boolean; error?: string }>, failTitle: string, onFail?: () => void) {
    startTransition(async () => {
      apply(change)
      // A rejected action (e.g. offline) would otherwise throw into the error boundary.
      const res = await action().catch(() => ({ success: false, error: 'Check your connection and try again.' }))
      if (!res.success) {
        toast.error(failTitle, res.error)
        onFail?.()
      }
    })
  }

  function add() {
    const content = draft.trim()
    if (!content) return
    setDraft('')
    run(
      { type: 'add', note: { id: `tmp-${++tempId}`, content, updated_at: new Date().toISOString() } },
      () => createDashboardNote(content),
      'Could not save note',
      () => setDraft(d => (d.trim() ? `${content}\n${d}` : content)),
    )
  }

  function save() {
    if (!editing) return
    const { id } = editing
    const content = editing.content.trim()
    if (!content) return
    setEditing(null)
    run({ type: 'update', id, content }, () => updateDashboardNote(id, content), 'Could not update note', () => setEditing({ id, content }))
  }

  async function remove(note: Note) {
    const ok = await confirmDialog({ title: 'Delete this note?', description: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true })
    if (ok) run({ type: 'delete', id: note.id }, () => deleteDashboardNote(note.id), 'Could not delete note')
  }

  // Cmd/Ctrl+Enter submits, Escape cancels an edit.
  const keys = (submit: () => void, cancel?: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape' && cancel) cancel()
  }

  return (
    <Section title="Notes" action={notes.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{notes.length}</span>}>
      <Panel className="overflow-hidden">
        <form
          onSubmit={e => {
            e.preventDefault()
            add()
          }}
          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-end"
        >
          <label htmlFor="new-note" className="sr-only">
            New note
          </label>
          <Textarea
            id="new-note"
            rows={1}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={keys(add)}
            placeholder="Jot something down — a pending payment, a reminder…"
            className={`${INPUT} max-h-48 min-h-11`}
          />
          <Button type="submit" disabled={!draft.trim()} className="h-11 shrink-0 rounded-xl px-4">
            <Plus />
            Add note
          </Button>
        </form>

        {notes.length === 0 ? (
          <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">No notes yet. Anything you write here stays on your dashboard.</p>
        ) : (
          <ul className="divide-y border-t">
            {notes.map(note =>
              editing?.id === note.id ? (
                <li key={note.id} className="space-y-2 p-3">
                  <label htmlFor={`note-${note.id}`} className="sr-only">
                    Edit note
                  </label>
                  <Textarea
                    id={`note-${note.id}`}
                    value={editing.content}
                    onChange={e => setEditing({ id: note.id, content: e.target.value })}
                    onKeyDown={keys(save, () => setEditing(null))}
                    className={`${INPUT} max-h-72 min-h-20`}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" className="h-10 rounded-xl px-4" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button className="h-10 rounded-xl px-4" onClick={save} disabled={!editing.content.trim()}>
                      Save
                    </Button>
                  </div>
                </li>
              ) : (
                <li key={note.id} className="flex gap-3 py-3 pr-2 pl-4 animate-in fade-in-0">
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="text-sm break-words whitespace-pre-wrap">{note.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isTemp(note.id) ? (
                        'Saving…'
                      ) : (
                        <time dateTime={note.updated_at}>{stamp(note.updated_at)}</time>
                      )}
                    </p>
                  </div>
                  {!isTemp(note.id) && (
                    <div className="flex shrink-0 items-start gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="rounded-xl text-muted-foreground"
                        aria-label="Edit note"
                        onClick={() => setEditing({ id: note.id, content: note.content })}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete note"
                        onClick={() => remove(note)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </Panel>
    </Section>
  )
}
