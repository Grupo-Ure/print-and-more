import type { ReactNode } from 'react'

/** One setting of a one-row settings section: its title and what it does on the left, its field on the right. */
export function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-neutral-200 px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-neutral-500 desktop:text-sm">{description}</p>
      </div>
      {children}
    </div>
  )
}
