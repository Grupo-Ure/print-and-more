import { CheckCircle2, Lock } from 'lucide-react'
import { useSetJobStatus } from '../queries/jobQueries'
import type { JobRow } from '../types/database'
import { useToast } from './Toast'
import { Button } from './ui/button'

type Props = {
  job: JobRow
}

export function JobProductionBanner({ job }: Props) {
  const setJobStatus = useSetJobStatus()
  const { showError } = useToast()

  // Done is terminal: a green, button-less banner — no going back once a job is done.
  if (job.status === 'DONE') {
    return (
      <div className="flex items-center justify-center gap-4 border-b-6 border-green-500 px-4 py-2 text-green-500">
        <CheckCircle2 />
        <p className="text-sm font-medium">
          This job is done and can no longer be modified.
        </p>
      </div>
    )
  }

  if (job.status !== 'PRODUCTION_READY') return null

  const handleGoBackToPrePress = async () => {
    try {
      await setJobStatus.mutateAsync({
        id: job.id,
        orderId: job.order_id,
        status: 'PREPRESS_READY',
        history: { event_type: 'PREPRESS_READY_MANUAL' },
      })
    } catch {
      showError('Status could not be updated')
    }
  }

  return (
    <div className="flex items-center justify-center gap-4 border-b-6 border-blue-500 px-4 py-2 text-blue-500">
      <Lock/>
      <p className="text-sm font-medium">
        This job is in production and cannot be modified.
      </p>
      <Button
        type="button"
        variant="default"
        className="shrink-0 rounded-full bg-pink-500 hover:bg-pink-600"
        disabled={setJobStatus.isPending}
        onClick={() => void handleGoBackToPrePress()}
      >
        {setJobStatus.isPending ? '…' : 'Go back to Pre-Press'}
      </Button>
    </div>
  )
}
