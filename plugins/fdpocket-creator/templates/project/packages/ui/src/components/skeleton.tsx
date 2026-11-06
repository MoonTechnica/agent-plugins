import { cn } from 'cn'
import type * as React from 'react'

/** 読み込み中の骨格。実際の表示と同じ大きさにして、読み込み後にレイアウトが動かないようにする。 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export { Skeleton }
