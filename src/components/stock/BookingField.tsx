import { Button } from '@/components/ui/button'
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
          className="h-8 w-13 rounded-lg border border-input bg-background px-2 text-sm [appearance:textfield]"
          aria-label="Booking quantity"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={inboundDisabled}
          onClick={() => void booking.book(item, 'INBOUND')}
          title="Book stock in"
        >
          +
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={outboundDisabled}
          onClick={() => void booking.book(item, 'OUTBOUND')}
          title="Book stock out"
        >
          −
        </Button>
      </div>
      {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
    </div>
  )
}
