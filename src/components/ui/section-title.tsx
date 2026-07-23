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

export { SectionTitle }
