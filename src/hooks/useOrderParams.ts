import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export const ORDER_PARAM = 'order'
export const JOB_PARAM = 'job'

export function useOrderParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeOrderId = searchParams.get(ORDER_PARAM) ?? null
  const activeJobId = searchParams.get(JOB_PARAM) ?? null

  const setActiveOrder = useCallback(
    (orderId: string | null) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          const current = next.get(ORDER_PARAM)
          if (orderId == null) {
            next.delete(ORDER_PARAM)
            next.delete(JOB_PARAM)
          } else {
            next.set(ORDER_PARAM, orderId)
            if (current !== orderId) next.delete(JOB_PARAM)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setActiveJob = useCallback(
    (jobId: string | null) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          if (jobId == null) next.delete(JOB_PARAM)
          else next.set(JOB_PARAM, jobId)
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
        next.delete(JOB_PARAM)
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  return { activeOrderId, activeJobId, setActiveOrder, setActiveJob, clearActive }
}
