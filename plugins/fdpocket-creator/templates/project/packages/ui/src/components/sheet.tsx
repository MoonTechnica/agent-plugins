import { cn } from 'cn'
import { XIcon } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import type * as React from 'react'

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close

/**
 * 入力フォーム・選択肢・詳細を重ねて出す。幅で形を変える（`$app-responsive` §5。Material の
 * ボトムシート → ダイアログ、Apple の sheet と同じ切り替え）:
 * - スマホ幅（`md` 未満）: 下から出るシート（中央のダイアログはキーボードと重なる）。上端に持ち手、下端は安全領域を避ける
 * - `md` 以上: 画面の中央のダイアログ（PC の画面いっぱいに横長のシートを出さない）
 */
function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[calc(100dvh_-_var(--safe-top)_-_2rem)] w-full max-w-2xl flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-3xl border-t bg-popover p-5 pr-[max(1.25rem,var(--safe-right))] pb-[max(1.25rem,var(--safe-bottom))] pl-[max(1.25rem,var(--safe-left))] text-popover-foreground shadow-lg outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom motion-reduce:animate-none',
          'md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[calc(100dvh_-_4rem)] md:w-[calc(100%_-_4rem)] md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:p-6 md:data-[state=closed]:slide-out-to-bottom-4 md:data-[state=open]:slide-in-from-bottom-4',
          className
        )}
        {...props}
      >
        <div aria-hidden className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-border md:hidden" />
        {children}
        <SheetPrimitive.Close
          aria-label="Close"
          className="absolute top-4 right-3 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon aria-hidden className="size-5" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn('flex flex-col gap-1.5 pr-10', className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('flex flex-col gap-2', className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-lg leading-snug font-semibold', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
