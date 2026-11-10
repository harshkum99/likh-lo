import type { Box } from '@/lib/register/layout'
import { cropStyle } from '@/lib/register/review'
import { cn } from '@/lib/utils'

/** OCR pixel space of the photo (boxes are in it). */
export type Size = { width: number; height: number }

const pct = (v: number, of: number) => `${(v / of) * 100}%`

/** The register photo with line boxes drawn over it (in percentages, so they scale with the image). */
export function PhotoWithBoxes({
  url,
  size,
  boxes = [],
  active = null,
  appear = false,
  className,
  style,
  children,
}: {
  url: string
  size: Size | null
  boxes?: (Box | null)[]
  active?: number | null
  /** Fade boxes in one after another (while reading). */
  appear?: boolean
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border bg-muted', className)} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL: nothing for next/image to optimise */}
      <img src={url} alt="Register page" className="block h-auto w-full" />
      {size &&
        boxes.map((b, i) =>
          b ? (
            <span
              key={i}
              aria-hidden
              className={cn(
                'absolute rounded-[3px] transition-colors',
                i === active ? 'bg-primary/20 ring-2 ring-primary' : 'bg-primary/5 ring-1 ring-primary/40',
                appear && 'animate-in bg-primary/10 ring-primary/70 fill-mode-backwards fade-in-0 zoom-in-95 duration-300',
              )}
              style={{
                left: pct(b.x, size.width),
                top: pct(b.y, size.height),
                width: pct(b.width, size.width),
                height: pct(b.height, size.height),
                animationDelay: appear ? `${i * 40}ms` : undefined,
              }}
            />
          ) : null,
        )}
      {children}
    </div>
  )
}

/** One handwritten line cut out of the photo: a CSS background crop, no canvas. At most 40px tall, aspect kept. */
export function LineCrop({ url, size, box, className }: { url: string; size: Size; box: Box; className?: string }) {
  return (
    <div
      role="img"
      aria-label="Handwritten line from the photo"
      className={cn('rounded-md border bg-muted bg-no-repeat', className)}
      style={{ backgroundImage: `url("${url}")`, ...cropStyle(box, size) }}
    />
  )
}
