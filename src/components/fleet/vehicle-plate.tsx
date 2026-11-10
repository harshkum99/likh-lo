import { cn } from '@/lib/utils'

/** "jh01ab1234" / "JH-01-AB-1234" -> "JH 01 AB 1234" (also "22BH1234AA" -> "22 BH 1234 AA"). */
export const formatPlate = (v: string) =>
  v.trim().toUpperCase().replace(/[\s-]+/g, '').replace(/(?<=[A-Z])(?=\d)|(?<=\d)(?=[A-Z])/g, ' ')

/**
 * Indian commercial number plate (yellow, black text, blue "IND" strip). Scales with font-size:
 * pass `className="text-xs"` for a smaller plate. Plate colours are literal on purpose (a physical object, not UI chrome).
 */
export function VehiclePlate({ number, ind = true, className }: { number: string; ind?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-stretch overflow-hidden rounded-[0.4em] border-[1.5px] border-[oklch(0.25_0.02_260)] bg-[oklch(0.9_0.14_96)] font-mono text-sm leading-none font-bold text-[oklch(0.2_0.02_260)] shadow-sm shadow-black/10 dark:border-[oklch(0.15_0.02_260)] dark:bg-[oklch(0.8_0.12_92)]',
        className,
      )}
    >
      {ind && (
        <span aria-hidden className="flex items-center bg-[oklch(0.45_0.15_262)] px-[0.3em] text-[0.55em] font-semibold tracking-normal text-white">
          IND
        </span>
      )}
      <span className="px-[0.55em] py-[0.4em] truncate tracking-wide">{formatPlate(number)}</span>
    </span>
  )
}
