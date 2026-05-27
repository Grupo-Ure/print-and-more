import { useQuery } from '@tanstack/react-query'
import { employeeService } from '../services/employeeService'

export const employeeKeys = {
  all: ['employees'] as const,
  profile: (id: string) => ['employees', 'profile', id] as const,
}

export function useEmployeeProfile(userId: string | null) {
  return useQuery({
    queryKey: userId ? employeeKeys.profile(userId) : employeeKeys.profile('__none__'),
    queryFn: () => employeeService.getProfile(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })
}
