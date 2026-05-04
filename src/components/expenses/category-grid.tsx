'use client'

import { useState, useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createCategory } from '@/app/expenses/actions'
import { useRouter } from 'next/navigation'

interface Category {
  id: string
  name: string
  is_default: boolean
}

interface CategoryGridProps {
  categories: Category[]
  selectedCategory: string | null
  onSelect: (category: string) => void
}

export function CategoryGrid({ categories, selectedCategory, onSelect }: CategoryGridProps) {
  const [mounted, setMounted] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Prevents hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="grid grid-cols-2 gap-3 h-32 animate-pulse bg-zinc-50 rounded-2xl" />

  const handleAddCategory = async () => {
    if (!newCategoryName) return
    setLoading(true)
    const result = await createCategory(newCategoryName)
    if (result.success) {
      setIsAdding(false)
      setNewCategoryName('')
      router.refresh()
    } else {
      alert(result.error || 'Failed to add category')
    }
    setLoading(false)
  }

  // Use a Map to ensure unique names even if the DB has duplicates
  const uniqueCategories = Array.from(
    new Map(categories.map(c => [c.name.toLowerCase(), c])).values()
  )

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {uniqueCategories.map((category) => (
        <Button
          key={category.id}
          type="button"
          variant={selectedCategory === category.name ? 'default' : 'outline'}
          className={cn(
            "h-16 text-xs font-bold px-2 text-center break-words rounded-xl transition-all active:scale-[0.98]",
            selectedCategory === category.name 
              ? "bg-[#1a365d] text-white hover:bg-[#1a365d]/90 border-transparent shadow-md" 
              : "border-zinc-100 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
          )}
          onClick={() => onSelect(category.name)}
        >
          {category.name}
        </Button>
      ))}
      
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogTrigger 
          type="button"
          className={cn(
            "h-16 text-xs font-bold px-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-400 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all active:scale-[0.98]",
          )}
        >
          + Add
        </DialogTrigger>
        <DialogContent className="rounded-3xl max-w-[90vw] sm:max-w-md">

          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input 
                id="category-name" 
                placeholder="e.g. Repairs, Food, Loading"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="h-14 bg-zinc-50 border-none rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button"
              className="w-full h-14 text-lg font-bold bg-[#1a365d] rounded-xl"
              onClick={handleAddCategory}
              disabled={loading || !newCategoryName}
            >
              {loading ? 'Adding...' : 'Save Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
