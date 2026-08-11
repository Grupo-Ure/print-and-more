import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { stampService } from '../services/stampService'
import { jobService } from '../services/jobService'
import { departmentProductService } from '../services/departmentProductService'
import { reorderQuantity } from '../components/stock/stockShared'
import type { OrderListRow } from '../components/stampStock/stampStockShared'

export const stampStockKeys = {
  all: ['stamp-stock'] as const,
  models: ['stamp-stock', 'models'] as const,
  masterData: ['stamp-stock', 'master-data'] as const,
  padArticleNumbers: ['stamp-stock', 'pad-article-numbers'] as const,
  movements: ['stamp-stock', 'movements'] as const,
  reorderList: ['stamp-stock', 'reorder-list'] as const,
}

export function useStampModels() {
  return useQuery({
    queryKey: stampStockKeys.models,
    queryFn: () => stampService.getStampModels(),
  })
}

/** All models including inactive ones — master-data tab. */
export function useStampMasterData() {
  return useQuery({
    queryKey: stampStockKeys.masterData,
    queryFn: () => stampService.getAllStampModelsForMasterData(),
  })
}

export function usePadArticleNumbers() {
  return useQuery({
    queryKey: stampStockKeys.padArticleNumbers,
    queryFn: () => stampService.getPadArticleNumbers(),
  })
}

type StampModelInsert = Parameters<typeof stampService.createStampModel>[0]
type StampModelPatch = Parameters<typeof stampService.updateStampModel>[1]

export function useCreateStampModel() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, StampModelInsert>({
    mutationFn: payload => stampService.createStampModel(payload),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: stampStockKeys.all })
    },
  })
}

export function useUpdateStampModel() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { modelId: string; patch: StampModelPatch }>({
    mutationFn: ({ modelId, patch }) => stampService.updateStampModel(modelId, patch),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: stampStockKeys.all })
    },
  })
}

export function useStampMovements() {
  return useQuery({
    queryKey: stampStockKeys.movements,
    queryFn: () => stampService.getStockMovements(),
  })
}

/** Open demand per model from active STAMP jobs, joined onto the models. */
async function fetchStampReorderList(): Promise<OrderListRow[]> {
  const activeModels = await stampService.getStampModels()
  const allJobs = await jobService.getActiveJobsByBereich('STAMP')
  const activeJobIds = allJobs
    .filter(job => job.status !== 'DONE' && !job.is_cancelled)
    .map(job => job.id)

  const activeModelIds = new Set(activeModels.map(model => model.id))
  const modelUsage = await departmentProductService.getStampModelUsageByJobs(activeJobIds)

  const demandByModelId = new Map<string, number>()
  for (const { modelId, quantity } of modelUsage) {
    if (!activeModelIds.has(modelId)) continue
    demandByModelId.set(modelId, (demandByModelId.get(modelId) ?? 0) + quantity)
  }

  const orderRows: OrderListRow[] = []
  for (const model of activeModels) {
    const openQuantity = demandByModelId.get(model.id) ?? 0
    const orderQuantity = reorderQuantity(model.min_stock, openQuantity, model.stock)
    if (orderQuantity <= 0) continue
    orderRows.push({ ...model, openQuantity, orderQuantity })
  }
  orderRows.sort((firstRow, secondRow) => secondRow.orderQuantity - firstRow.orderQuantity)
  return orderRows
}

export function useStampReorderList() {
  return useQuery({
    queryKey: stampStockKeys.reorderList,
    queryFn: fetchStampReorderList,
  })
}

export type BookStampMovementPayload = {
  modelId: string
  quantity: number
  nextStock: number
  type: 'INBOUND' | 'OUTBOUND'
  userId: string
}

export function useBookStampMovement() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, BookStampMovementPayload>({
    mutationFn: async ({ modelId, quantity, nextStock, type, userId }) => {
      await stampService.updateStampModelStock(modelId, nextStock)
      await stampService.createStockMovement({
        model_id: modelId,
        quantity,
        type,
        user_id: userId,
      })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: stampStockKeys.all })
    },
  })
}

export function useSaveStampMinimumStock() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { modelId: string; minimumStock: number }>({
    mutationFn: ({ modelId, minimumStock }) =>
      stampService.updateStampModelMinimumStock(modelId, minimumStock),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: stampStockKeys.all })
    },
  })
}
