/** OTHER department form (single type). */

import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { useSaveProduct } from '../../../queries/productQueries'
import type { ProductChildInsert, ProductWriteInput } from '../../../types/product'
import { strOut, qtyOut } from '../../../lib/products/schemas/_shared'
import { validateProduct } from '../../../lib/products/registry'
import { useToast } from '../../Toast'
import { valuesFromProduct, type FormValues, type ProductFormProps } from './shared'
import { FilePickerField, FormActions, QuantityField, TextareaField } from './fields'

function buildChild(values: FormValues): ProductChildInsert {
  return { description: strOut(values.description) } as ProductChildInsert
}

export function OtherForm({ job, jobStatus, product, orderFiles, initialFileIds, sortOrder, onSaved, onCancel }: ProductFormProps) {
  const saveProduct = useSaveProduct()
  const { showError } = useToast()
  const [fileIds, setFileIds] = useState<string[]>(initialFileIds)

  const form = useForm({
    defaultValues: { description: '', quantity: '', ...valuesFromProduct(product) } as FormValues,
    onSubmit: ({ value }) => {
      if (Object.keys(validateProduct('OTHER', value, jobStatus)).length > 0) return
      const input: ProductWriteInput = {
        ...(product ? { id: product.id } : {}),
        job_id: job.id,
        department: job.department,
        type: 'OTHER',
        quantity: qtyOut(value.quantity),
        notes: null,
        sort_order: sortOrder,
        child: buildChild(value),
      }
      saveProduct.mutate(
        { input, fileIds, jobId: job.id },
        { onSuccess: ({ products }) => onSaved(products), onError: () => showError(product ? 'Product could not be saved' : 'Product could not be added') },
      )
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
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('OTHER', values, jobStatus)
          return (
            <>
              <form.Field name="description">
                {field => <TextareaField field={field} label="Description / Content" error={errors.description} hint="Changes after production release will reset the status" />}
              </form.Field>

              <form.Field name="quantity">
                {field => <QuantityField field={field} label="Quantity (optional)" error={errors.quantity} hint="If relevant, enter quantity here or in the description" />}
              </form.Field>

              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={orderFiles} />

              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={saveProduct.isPending} editing={!!product} onCancel={onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </form>
  )
}
