import { Fragment, type ReactNode } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Separator } from '../ui/separator'

export type JobSection = {
  key: string
  title: string
  content: ReactNode
}

/**
 * Responsive container for the sections between the job header and the
 * products area (Job Settings, Time Logs, …). Desktop renders them
 * side-by-side with vertical separators; below the breakpoint there is no
 * room for all of them, so they become tabs showing one section at a time.
 * Adding a future section is one more entry in the `sections` array at the
 * call site — no layout work needed here.
 */
export function JobSections({ sections }: { sections: JobSection[] }) {
  const isCompact = useIsMobile()

  if (sections.length === 0) return null

  if (isCompact) {
    return (
      <Tabs defaultValue={sections[0].key}>
        {/* line variant: plain text triggers, primary-colored underline on the active
            tab. w-full stretches the list across the pane; the flex-1 triggers then
            share the width evenly instead of clustering at the start. */}
        <TabsList variant="line" className="w-full">
          {sections.map(section => (
            <TabsTrigger key={section.key} value={section.key} className="text-sm">
              {section.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {sections.map(section => (
          <TabsContent key={section.key} value={section.key}>
            {section.content}
          </TabsContent>
        ))}
      </Tabs>
    )
  }

  return (
    <div className="flex gap-6">
      {sections.map((section, index) => (
        <Fragment key={section.key}>
          {index > 0 && <Separator orientation="vertical" className="h-auto" />}
          <section className="flex min-w-0 flex-col gap-2">
            <h2>{section.title}</h2>
            {section.content}
          </section>
        </Fragment>
      ))}
    </div>
  )
}
