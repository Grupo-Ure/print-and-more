import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  departmentSettingsService,
  type DepartmentDefaultAssignee,
} from '../services/departmentSettingsService'
import type { Department } from '../types/database'

export const departmentSettingsKeys = {
  all: ['department-settings'] as const,
  defaultAssignees: ['department-settings', 'default-assignees'] as const,
}

export function useDepartmentDefaultAssignees() {
  return useQuery({
    queryKey: departmentSettingsKeys.defaultAssignees,
    queryFn: () => departmentSettingsService.getDefaultAssignees(),
    staleTime: 60_000,
  })
}

/**
 * Sets or clears (`userId: null`) a department's default assignee. Patches the
 * cached list optimistically so the combobox shows the pick at once; the
 * snapshot is restored on error.
 */
export function useSetDepartmentDefaultAssignee() {
  const queryClient = useQueryClient()
  return useMutation<
    void,
    Error,
    { department: Department; userId: string | null },
    { previous?: DepartmentDefaultAssignee[] }
  >({
    mutationFn: ({ department, userId }) =>
      departmentSettingsService.setDefaultAssignee(department, userId),
    onMutate: async ({ department, userId }) => {
      await queryClient.cancelQueries({ queryKey: departmentSettingsKeys.defaultAssignees })
      const previous = queryClient.getQueryData<DepartmentDefaultAssignee[]>(
        departmentSettingsKeys.defaultAssignees,
      )
      queryClient.setQueryData<DepartmentDefaultAssignee[]>(
        departmentSettingsKeys.defaultAssignees,
        old => {
          const rest = (old ?? []).filter(row => row.department !== department)
          return userId === null ? rest : [...rest, { department, user_id: userId }]
        },
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(departmentSettingsKeys.defaultAssignees, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: departmentSettingsKeys.all })
    },
  })
}
