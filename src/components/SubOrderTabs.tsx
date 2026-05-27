import { Plus } from 'lucide-react'
import { subOrderDepartmentLabel } from '../const/departmentAbbreviation'
import type { SubOrderRow } from '../types/database'
import { Button } from './ui/button'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'

type SubOrderTabsProps = {
  subOrders: SubOrderRow[]
  activeSubOrderId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
}

export function SubOrderTabs({ subOrders, activeSubOrderId, onSelect, onAdd }: SubOrderTabsProps) {
  if (subOrders.length === 0) {
    return (
      <div className="flex items-center justify-center">
        <Button type="button" size="lg" variant="ghost" onClick={onAdd} aria-label="Add sub-order">
          <p>
            Add a sub-order
          </p>
          <Plus />
        </Button>
      </div>
    )
  }

  return (
    <nav className='flex items-center justify-between mb-4'>
      <Tabs
        value={activeSubOrderId ?? undefined}
        onValueChange={onSelect}
        className="flex-row items-start gap-2 flex-1 min-w-0"
      >
        <TabsList aria-label="Sub-orders" variant="line" className="grid w-full grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-x-1 gap-y-3 group-data-horizontal/tabs:h-auto">
          {subOrders.map(subOrder => (
            <TabsTrigger key={subOrder.id} value={subOrder.id}>
              {subOrderDepartmentLabel(subOrder.department)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Button
        title='Add sub-order'
        type="button"
        size="icon-lg"
        variant="ghost"
        onClick={onAdd}
        aria-label="Add sub-order"
      >
        <Plus />
      </Button>
    </nav>
  )
}
