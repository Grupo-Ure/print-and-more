import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Replace } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useCreateOrder } from '../queries/orderQueries'
import { useInfiniteCustomers } from '../queries/customerQueries'
import { useOrderWorkspace } from '../context/order.context'
import type { Customer } from '../types/database'

export function NewOrderDialog() {
  const [open, setOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const { setActiveOrder, openCustomerDialog } = useOrderWorkspace()
  const createOrder = useCreateOrder()

  useEffect(() => {
    if (!open) {
      setSelectedCustomer(null)
      setSearchInput('')
      setDebouncedQuery('')
      createOrder.reset()
    }
    // createOrder is intentionally omitted — useMutation returns a new object every render,
    // which would cause an infinite loop. createOrder.reset is a stable method.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteCustomers(debouncedQuery)
  const results = useMemo(() => (data?.pages.flat() ?? []) as Customer[], [data])

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!scrollEl || !sentinelEl) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { root: scrollEl, rootMargin: '50px' },
    )
    observer.observe(sentinelEl)
    return () => observer.disconnect()
  }, [scrollEl, sentinelEl, hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleSubmit = async () => {
    if (!selectedCustomer) return
    try {
      // order_number is generated server-side via DB default; the client omits it.
      const payload = {
        customer_id: selectedCustomer.id,
        status: 'QUOTE',
        deadline: null,
        delivery: 'PICKUP',
        priority: 'NORMAL',
      } as Parameters<typeof createOrder.mutateAsync>[0]
      const order = await createOrder.mutateAsync(payload)
      setActiveOrder(order.id)
      setOpen(false)
    } catch {
      // mutation error surfaces via createOrder.error below
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            className="h-16 text-2xl px-12 m-auto"
          >
            <Plus strokeWidth={4} />
            New Order
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md p-8">
          <DialogHeader>
            <DialogTitle>New Order</DialogTitle>
          </DialogHeader>

          {createOrder.error && (
            <p className="text-destructive">
              {createOrder.error instanceof Error ? createOrder.error.message : 'Error creating order'}
            </p>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="uppercase tracking-[0.06em] text-muted-foreground">
              Customer
            </h2>

            {selectedCustomer == null ? (
              <>
                <Input
                  type="search"
                  placeholder="Search customer…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  autoFocus
                />
                <div ref={setScrollEl} className="max-h-48 overflow-y-auto rounded-md border border-border">
                  {isFetching && !isFetchingNextPage && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
                  )}
                  {!isFetching && results.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
                  )}
                  {results.map(customer => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setSelectedCustomer(customer)}
                      className={cn(
                        'block w-full border-b border-border px-3 py-2 text-left text-sm hover:bg-muted',
                        'last:border-b-0',
                      )}
                    >
                      <div className="font-medium">{customer.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {customer.email || customer.phone || '—'}
                      </div>
                    </button>
                  ))}
                  <div ref={setSentinelEl} />
                  {isFetchingNextPage && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Loading more…</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openCustomerDialog(null, { onSaved: setSelectedCustomer })}
                >
                  <Plus className="size-3.5" />
                  New Customer
                </Button>
              </>
            ) : (
              <div className="flex items-start justify-between gap-3 rounded-md bg-muted p-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{selectedCustomer.name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {selectedCustomer.email || selectedCustomer.phone || '—'}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => openCustomerDialog(selectedCustomer, { onSaved: setSelectedCustomer })}
                  >
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    <Replace className="size-3" />
                    Change
                  </Button>
                </div>
              </div>
            )}
          </section>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createOrder.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!selectedCustomer || createOrder.isPending}
            >
              {createOrder.isPending ? 'Creating…' : 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  )
}
