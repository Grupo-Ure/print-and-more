import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export const ORDER_PARAM = 'order'
export const SUB_ORDER_PARAM = 'sub'

export function useOrderParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeOrderId = searchParams.get(ORDER_PARAM) ?? null
  const activeSubOrderId = searchParams.get(SUB_ORDER_PARAM) ?? null

  const setActiveOrder = useCallback(
    (orderId: string | null) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          const current = next.get(ORDER_PARAM)
          if (orderId == null) {
            next.delete(ORDER_PARAM)
            next.delete(SUB_ORDER_PARAM)
          } else {
            next.set(ORDER_PARAM, orderId)
            if (current !== orderId) next.delete(SUB_ORDER_PARAM)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setActiveSubOrder = useCallback(
    (subOrderId: string | null) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          if (subOrderId == null) next.delete(SUB_ORDER_PARAM)
          else next.set(SUB_ORDER_PARAM, subOrderId)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clearActive = useCallback(() => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete(ORDER_PARAM)
        next.delete(SUB_ORDER_PARAM)
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  return { activeOrderId, activeSubOrderId, setActiveOrder, setActiveSubOrder, clearActive }
}
