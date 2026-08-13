import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { stockInputClass } from './stockShared'
import type { BookingItem, StockBooking } from './useStockBooking'

type BookingFieldProps = {
  item: BookingItem
  booking: StockBooking
}

/** Quantity input with stock-in / stock-out buttons, one per table row. */
export function BookingField({ item, booking }: BookingFieldProps) {
  const quantity = booking.parsedQuantity(item.id)
  const inboundDisabled = quantity == null || booking.busyId != null
  const outboundDisabled = inboundDisabled || (quantity != null && quantity > (item.stock ?? 0))
  const error = booking.errorFor(item.id)

  return (
    <div>
      <div className="inline-flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          step={1}
          value={booking.quantityFor(item.id)}
          onChange={event => booking.setQuantity(item.id, event.target.value)}
          className={cn(stockInputClass, 'w-13 px-2 text-right tabular-nums [appearance:textfield]')}
          aria-label="Booking quantity"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={inboundDisabled}
          onClick={() => void booking.book(item, 'INBOUND')}
          title="Increase stock"
          aria-label="Increase stock"
        >
          <Plus />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={outboundDisabled}
          onClick={() => void booking.book(item, 'OUTBOUND')}
          title="Decrease stock"
          aria-label="Decrease stock"
        >
          <Minus />
        </Button>
      </div>
      {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
    </div>
  )
}
