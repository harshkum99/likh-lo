'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
import { Plus, Search, X } from 'lucide-react'

interface Category {
  id: string
  name: string
  is_default: boolean
  is_active: boolean
  category_group?: string
  user_id?: string
}

interface CategoryGridProps {
  categories: Category[]
  amounts: Record<string, string>
  onAmountChange: (categoryId: string, amount: string) => void
  usedCategoryIds?: Set<string>
}

export function CategoryGrid({ 
  categories, 
  amounts, 
  onAmountChange, 
  usedCategoryIds = new Set() 
}: CategoryGridProps) {
  const [mounted, setMounted] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [selectedInactiveId, setSelectedInactiveId] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<'All' | 'Fuel' | 'Labour' | 'Material' | 'Other'>('All')
  
  const router = useRouter()
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const groups = ['All', 'Fuel', 'Labour', 'Material', 'Other'] as const

  const toTitleCase = (str: string) => {
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesGroup = activeGroup === 'All' || c.category_group === activeGroup
      return matchesSearch && matchesGroup && c.is_active
    })
  }, [categories, searchQuery, activeGroup])

  const { used, unused } = useMemo(() => {
    const usedList: Category[] = []
    const unusedList: Category[] = []
    
    filteredCategories.forEach(c => {
      if (usedCategoryIds.has(c.id) || (amounts[c.id] && parseFloat(amounts[c.id]) > 0)) {
        usedList.push(c)
      } else {
        unusedList.push(c)
      }
    })
    
    return { used: usedList, unused: unusedList }
  }, [filteredCategories, usedCategoryIds, amounts])

  if (!mounted) return <div className="grid grid-cols-2 gap-3 h-32 animate-pulse bg-zinc-50 rounded-2xl" />

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
    }, 800)
  }

  const endPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const renderGrid = (items: Category[], title?: string) => {
    if (items.length === 0) return null
    
    return (
      <div className="space-y-3">
        {title && (
          <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">
            {title}
          </h3>
        )}
        <div className="grid grid-cols-2 gap-3">
          {items.map((category) => (
            <div key={category.id} className="space-y-2">
              <div
                onMouseDown={() => startPress(category)}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                onTouchStart={() => startPress(category)}
                onTouchEnd={endPress}
                className={cn(
                  "relative group h-28 p-4 rounded-3xl border transition-all duration-200 select-none flex flex-col justify-between cursor-pointer",
                  amounts[category.id]
                    ? "bg-[#1a365d] border-[#1a365d] shadow-lg shadow-blue-900/20 scale-[1.02]"
                    : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 shadow-sm",
                  deactivatingId === category.id && "opacity-50 scale-95"
                )}
              >
                <label className={cn(
                  "block text-[11px] font-black uppercase tracking-tight transition-colors pointer-events-none line-clamp-2",
                  amounts[category.id] ? "text-white/70" : "text-zinc-400"
                )}>
                  {toTitleCase(category.name)}
                </label>
                
                <div className="flex items-center gap-1">
                  <span className={cn(
                    "text-xl font-black transition-colors",
                    amounts[category.id] ? "text-white/40" : "text-zinc-200"
                  )}>
                    ₹
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "w-full bg-transparent border-none p-0 text-xl font-black focus:ring-0 placeholder:opacity-20 transition-colors",
                      amounts[category.id] ? "text-white placeholder:text-white/30" : "text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                    )}
                    value={amounts[category.id] || ''}
                    onChange={(e) => onAmountChange(category.id, e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Search category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-12 bg-zinc-50 dark:bg-zinc-900 border-none rounded-2xl font-bold"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full"
            >
              <X className="h-3 w-3 text-zinc-400" />
            </button>
          )}
        </div>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
          {groups.map(group => (
            <button
              key={group}
              onClick={() => setActiveGroup(group)}
              className={cn(
                "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                activeGroup === group 
                  ? "bg-[#1a365d] text-white shadow-md scale-105" 
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 hover:bg-zinc-200"
              )}
            >
              {group}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {renderGrid(used, "Used this trip")}
        {renderGrid(unused, searchQuery || activeGroup !== 'All' ? "Search Results" : "Add New")}
        
        {used.length === 0 && unused.length === 0 && (
          <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] border-2 border-dashed border-zinc-100 dark:border-zinc-800">
            <p className="text-sm font-bold text-zinc-400">No categories found</p>
          </div>
        )}
      </div>

      {/* Add Category Dialog */}
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
            <Button 
              variant="outline" 
              className="w-full h-14 rounded-[1.5rem] border-dashed border-2 border-zinc-200 text-zinc-400 font-black uppercase tracking-widest gap-2 hover:bg-zinc-50 transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              New Category
            </Button>
          }
        />
        <DialogContent className="rounded-[2rem] max-w-[90vw] sm:max-w-md p-8 border-none">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">Add Category</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            {!isCreatingNew ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">Select Hidden Category</Label>
                  <Select 
                    value={selectedInactiveId || ''} 
                    onValueChange={setSelectedInactiveId}
                    disabled={categories.filter(c => !c.is_active).length === 0}
                  >
                    <SelectTrigger className="h-14 bg-zinc-50 border-none rounded-2xl font-bold px-5">
                      <SelectValue placeholder="Choose existing..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      {categories.filter(c => !c.is_active).map((c) => (
                        <SelectItem key={c.id} value={c.id} className="rounded-xl py-3">
                          {toTitleCase(c.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="relative flex items-center gap-4">
                  <div className="h-px flex-1 bg-zinc-100" />
                  <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">OR</span>
                  <div className="h-px flex-1 bg-zinc-100" />
                </div>

                <Button 
                  type="button"
                  variant="outline"
                  className="w-full h-14 rounded-2xl border-dashed border-zinc-200 text-zinc-500 font-bold gap-2"
                  onClick={() => setIsCreatingNew(true)}
                >
                  <Plus className="h-4 w-4" />
                  Create Brand New
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="category-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">Category Name</Label>
                  <Input 
                    id="category-name" 
                    placeholder="e.g. Repairs, Food, Loading"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="h-14 bg-zinc-50 dark:bg-zinc-900 border-none rounded-2xl font-bold px-5"
                    autoFocus
                  />
                </div>
                <Button 
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-zinc-400 font-bold hover:text-zinc-600"
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
              className="w-full h-16 text-lg font-black bg-[#1a365d] rounded-2xl shadow-xl transition-all active:scale-[0.98]"
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
