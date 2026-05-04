'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createCategory, deactivateCategory, reactivateCategory } from '@/app/expenses/actions'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

interface Category {
  id: string
  name: string
  is_default: boolean
  is_active: boolean
  user_id?: string
}

interface CategoryGridProps {
  categories: Category[]
  amounts: Record<string, string>
  onAmountChange: (categoryId: string, amount: string) => void
}

export function CategoryGrid({ categories, amounts, onAmountChange }: CategoryGridProps) {
  const [mounted, setMounted] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [selectedInactiveId, setSelectedInactiveId] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const router = useRouter()
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)

  // Prevents hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="grid grid-cols-2 gap-3 h-32 animate-pulse bg-zinc-50 rounded-2xl" />

  const activeCategories = categories.filter(c => c.is_active)
  const inactiveCategories = categories.filter(c => !c.is_active)

  const handleAddCategory = async () => {
    setLoading(true)
    let result;
    
    if (isCreatingNew && newCategoryName) {
      result = await createCategory(newCategoryName)
    } else if (selectedInactiveId) {
      result = await reactivateCategory(selectedInactiveId)
    } else {
      setLoading(false)
      return
    }

    if (result.success) {
      setIsAdding(false)
      setNewCategoryName('')
      setSelectedInactiveId(null)
      setIsCreatingNew(false)
      router.refresh()
    } else {
      alert(result.error || 'Failed to add category')
    }
    setLoading(false)
  }

  const handleLongPress = async (category: Category) => {
    if (confirm(`Hide "${category.name}" category? It will remain in old trips but won't show here anymore.`)) {
      setDeactivatingId(category.id)
      const result = await deactivateCategory(category.id)
      if (!result.success) {
        alert(result.error || 'Failed to deactivate category')
      } else {
        router.refresh()
      }
      setDeactivatingId(null)
    }
  }

  const startPress = (category: Category) => {
    longPressTimer.current = setTimeout(() => {
      handleLongPress(category)
    }, 800) // 800ms for long press
  }

  const endPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // Use a Map to ensure unique IDs
  const uniqueActive = Array.from(
    new Map(activeCategories.map(c => [c.id, c])).values()
  )

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {uniqueActive.map((category) => (
        <div
          key={category.id}
          onMouseDown={() => startPress(category)}
          onMouseUp={endPress}
          onMouseLeave={endPress}
          onTouchStart={() => startPress(category)}
          onTouchEnd={endPress}
          className={cn(
            "relative group h-28 p-4 rounded-2xl border transition-all duration-200 select-none flex flex-col justify-between",
            amounts[category.id]
              ? "bg-[#1a365d] border-[#1a365d] shadow-md shadow-blue-900/10"
              : "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800",
            deactivatingId === category.id && "opacity-50 scale-95"
          )}
        >
          <label className={cn(
            "block text-[10px] font-bold uppercase tracking-wider transition-colors pointer-events-none",
            amounts[category.id] ? "text-white" : "text-black dark:text-zinc-100"
          )}>
            {category.name}
          </label>
          
          <div className="flex items-center gap-1">
            <span className={cn(
              "text-lg font-black transition-colors",
              amounts[category.id] ? "text-white/40" : "text-zinc-300"
            )}>
              ₹
            </span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              className={cn(
                "w-full bg-transparent border-none p-0 text-lg font-black focus:ring-0 placeholder:opacity-30 transition-colors",
                amounts[category.id] ? "text-white placeholder:text-white/30" : "text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
              )}
              value={amounts[category.id] || ''}
              onChange={(e) => onAmountChange(category.id, e.target.value)}
            />
          </div>
        </div>
      ))}
      
      <Dialog open={isAdding} onOpenChange={(open) => {
        setIsAdding(open)
        if (!open) {
          setIsCreatingNew(false)
          setSelectedInactiveId(null)
          setNewCategoryName('')
        }
      }}>
        <DialogTrigger 
          render={
            <button
              type="button"
              className={cn(
                "h-28 text-xs font-bold px-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl text-zinc-400 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all active:scale-[0.98]",
              )}
            >
              + Add
            </button>
          }
        />
        <DialogContent className="rounded-3xl max-w-[90vw] sm:max-w-md">

          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {!isCreatingNew ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Select Hidden Category</Label>
                  <Select 
                    value={selectedInactiveId || ''} 
                    onValueChange={setSelectedInactiveId}
                    disabled={inactiveCategories.length === 0}
                  >
                    <SelectTrigger className="h-14 bg-zinc-50 border-none rounded-xl font-bold">
                      <SelectValue placeholder={inactiveCategories.length > 0 ? "Choose existing..." : "No hidden categories"}>
                        {inactiveCategories.find(c => c.id === selectedInactiveId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {inactiveCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="rounded-lg font-medium">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="relative flex items-center gap-4">
                  <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                  <span className="text-[10px] font-bold text-zinc-300 uppercase">OR</span>
                  <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                </div>

                <Button 
                  type="button"
                  variant="outline"
                  className="w-full h-14 rounded-xl border-dashed border-zinc-200 text-zinc-500 font-bold gap-2"
                  onClick={() => setIsCreatingNew(true)}
                >
                  <Plus className="h-4 w-4" />
                  Create New Category
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category-name" className="text-xs font-bold uppercase tracking-wider text-zinc-400">Category Name</Label>
                  <Input 
                    id="category-name" 
                    placeholder="e.g. Repairs, Food, Loading"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="h-14 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl font-bold"
                    autoFocus
                  />
                </div>
                <Button 
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-zinc-500 font-bold"
                  onClick={() => setIsCreatingNew(false)}
                >
                  Back to existing categories
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              type="button"
              className="w-full h-14 text-lg font-bold bg-[#1a365d] rounded-xl"
              onClick={handleAddCategory}
              disabled={loading || (!selectedInactiveId && !newCategoryName)}
            >
              {loading ? 'Adding...' : isCreatingNew ? 'Save New Category' : 'Reactivate Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
