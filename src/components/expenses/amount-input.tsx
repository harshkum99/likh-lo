'use client'

import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
}

export function AmountInput({ value, onChange }: AmountInputProps) {
  const handleKey = (num: string | number) => {
    if (num === '.') {
      if (!value.includes('.')) onChange(value + '.')
    } else {
      onChange(value + num)
    }
  }

  const handleBack = () => {
    onChange(value.slice(0, -1))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <Label htmlFor="amount" className="text-zinc-500 font-medium">Amount (₹)</Label>
        <div className="text-5xl font-black tracking-tight py-2">
          {value || '0'}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
          <Button
            key={num}
            type="button"
            variant="outline"
            className="h-16 text-xl font-bold rounded-2xl border-zinc-100 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm active:scale-95 transition-all"
            onClick={() => handleKey(num)}
          >
            {num}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-16 text-xl font-bold rounded-2xl border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 shadow-sm active:scale-95 transition-all"
          onClick={handleBack}
        >
          ⌫
        </Button>
      </div>
    </div>
  )
}
