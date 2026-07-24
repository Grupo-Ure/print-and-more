import * as React from "react"

import { cn } from "@/lib/utils"

/** Section heading for the work-area tables (Products, Designs, Files, …). */
function SectionTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="section-title"
      className={cn(
        "text-base font-semibold text-secondary-accent desktop:text-lg",
        className
      )}
      {...props}
    />
  )
}

/** Section header row: title on the left, optional actions (children) on the right. */
function SectionHeader({
  title,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { title: React.ReactNode }) {
  return (
    <div
      data-slot="section-header"
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  )
}

export { SectionTitle, SectionHeader }
