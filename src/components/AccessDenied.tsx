import { useNavigation } from '../context/navigation.context'
import { Button } from '@/components/ui/button'

/** Full-area "no access" notice for role-gated pages. UX gating only — RLS and the Edge Function enforce the real rules. */
export function AccessDenied({ description }: { description: string }) {
  const { navigate } = useNavigation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 font-sans">
      <h1 className="text-lg font-semibold">Access denied</h1>
      <p className="text-sm text-neutral-500">{description}</p>
      <Button onClick={() => navigate('orders')}>Back to orders</Button>
    </div>
  )
}
