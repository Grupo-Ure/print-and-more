import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from '@tanstack/react-form'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useUpsertCustomer } from '../queries/customerQueries'
import type { Customer } from '../types/database'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSaved?: (customer: Customer) => void
}

type FormValues = {
  name: string
  email: string
  phone: string
  note: string
  street: string
  house_number: string
  postal_code: string
  city: string
}

function makeDefaults(customer: Customer | null): FormValues {
  return {
    name: customer?.name ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    note: customer?.note ?? '',
    street: customer?.street ?? '',
    house_number: customer?.house_number ?? '',
    postal_code: customer?.postal_code ?? '',
    city: customer?.city ?? '',
  }
}

function hasAddressData(customer: Customer | null): boolean {
  if (customer == null) return false
  return [customer.street, customer.house_number, customer.postal_code, customer.city].some(
    v => v != null && String(v).trim() !== '',
  )
}

function trimOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export function CustomerDialog({ open, onOpenChange, customer, onSaved }: Props) {
  const isEditing = customer != null
  const upsert = useUpsertCustomer()

  // Re-create the form key when the customer identity changes so default values reset cleanly.
  const formKey = customer?.id ?? '__new__'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Customer' : 'New Customer'}</DialogTitle>
        </DialogHeader>

        <CustomerForm
          key={formKey}
          customer={customer}
          submitting={upsert.isPending}
          serverError={upsert.error}
          onCancel={() => onOpenChange(false)}
          onSubmit={async values => {
            const payload = {
              id: customer?.id,
              name: values.name.trim(),
              email: trimOrNull(values.email),
              phone: trimOrNull(values.phone),
              note: trimOrNull(values.note),
              street: trimOrNull(values.street),
              house_number: trimOrNull(values.house_number),
              postal_code: trimOrNull(values.postal_code),
              city: trimOrNull(values.city),
            }
            const saved = await upsert.mutateAsync(payload)
            onSaved?.(saved as Customer)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

type CustomerFormProps = {
  customer: Customer | null
  submitting: boolean
  serverError: Error | null
  onCancel: () => void
  onSubmit: (values: FormValues) => Promise<void>
}

function CustomerForm({ customer, submitting, serverError, onCancel, onSubmit }: CustomerFormProps) {
  const defaultValues = useMemo(() => makeDefaults(customer), [customer])
  const [addressExpanded, setAddressExpanded] = useState(() => hasAddressData(customer))

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
      className="flex flex-col gap-3"
    >
      {serverError && (
        <p className="text-xs text-destructive">
          {serverError.message || 'Error saving customer'}
        </p>
      )}

      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) => (value.trim().length === 0 ? 'Name is required' : undefined),
          onBlur: ({ value }) => (value.trim().length === 0 ? 'Name is required' : undefined),
        }}
      >
        {field => (
          <FieldRow label="Name" htmlFor={field.name} error={fieldError(field.state.meta)}>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onChange={e => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              autoFocus
              required
              aria-invalid={fieldError(field.state.meta) ? true : undefined}
            />
          </FieldRow>
        )}
      </form.Field>

      <form.Field name="email">
        {field => (
          <FieldRow label="Email" htmlFor={field.name}>
            <Input
              id={field.name}
              name={field.name}
              type="email"
              value={field.state.value}
              onChange={e => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </FieldRow>
        )}
      </form.Field>

      <form.Field name="phone">
        {field => (
          <FieldRow label="Phone" htmlFor={field.name}>
            <Input
              id={field.name}
              name={field.name}
              type="tel"
              value={field.state.value}
              onChange={e => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </FieldRow>
        )}
      </form.Field>

      <form.Field name="note">
        {field => (
          <FieldRow label="Note" htmlFor={field.name}>
            <textarea
              id={field.name}
              name={field.name}
              value={field.state.value}
              onChange={e => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              rows={2}
              className={cn(
                'w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              )}
            />
          </FieldRow>
        )}
      </form.Field>

      <button
        type="button"
        onClick={() => setAddressExpanded(v => !v)}
        className="flex items-center gap-1 self-start text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground"
        aria-expanded={addressExpanded}
      >
        {addressExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        Address
      </button>

      {addressExpanded && (
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <form.Field name="street">
            {field => (
              <FieldRow label="Street" htmlFor={field.name}>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={e => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldRow>
            )}
          </form.Field>

          <form.Field name="house_number">
            {field => (
              <FieldRow label="No." htmlFor={field.name}>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={e => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldRow>
            )}
          </form.Field>

          <form.Field name="postal_code">
            {field => (
              <FieldRow label="Postal Code" htmlFor={field.name}>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={e => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldRow>
            )}
          </form.Field>

          <form.Field name="city">
            {field => (
              <FieldRow label="City" htmlFor={field.name}>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={e => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </FieldRow>
            )}
          </form.Field>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <form.Subscribe selector={state => state.canSubmit}>
          {canSubmit => (
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}

function FieldRow({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

type FieldMeta = {
  errors: Array<string | { message?: string } | undefined | null>
  isTouched?: boolean
}

function fieldError(meta: FieldMeta): string | undefined {
  if (!meta.isTouched) return undefined
  for (const err of meta.errors) {
    if (typeof err === 'string') return err
    if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
      return err.message
    }
  }
  return undefined
}
