import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userService } from '../services/userService'
import type { CreateUserInput, UserRow } from '../services/userService'
import { resizeAvatarImage } from '../lib/avatarImage'
import type { UserRole } from '../types/database'

export const userKeys = {
  all: ['users'] as const,
  list: ['users', 'list'] as const,
  current: ['users', 'current'] as const,
}

export function useUsers() {
  return useQuery({
    queryKey: userKeys.list,
    queryFn: () => userService.getUsers(),
    staleTime: 60_000,
  })
}

export function useCurrentUser() {
  return useQuery({
    queryKey: userKeys.current,
    queryFn: () => userService.getCurrentUser(),
    staleTime: 5 * 60_000,
  })
}

/** Hierarchical: super admins are admins too. */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { data, isLoading } = useCurrentUser()
  return {
    isAdmin: data?.role === 'ADMIN' || data?.role === 'SUPER_ADMIN',
    isLoading,
  }
}

export function useIsSuperAdmin(): { isSuperAdmin: boolean; isLoading: boolean } {
  const { data, isLoading } = useCurrentUser()
  return {
    isSuperAdmin: data?.role === 'SUPER_ADMIN',
    isLoading,
  }
}

export function useUpdateOwnName() {
  const queryClient = useQueryClient()
  return useMutation<UserRow, Error, string>({
    mutationFn: name => userService.updateOwnName(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}

/** Resize happens inside the mutation so isPending covers the whole flow. */
export function useUpdateOwnAvatar() {
  const queryClient = useQueryClient()
  return useMutation<UserRow, Error, File>({
    mutationFn: async file => userService.updateOwnAvatar(await resizeAvatarImage(file)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}

export function useRemoveOwnAvatar() {
  const queryClient = useQueryClient()
  return useMutation<UserRow, Error, void>({
    mutationFn: () => userService.removeOwnAvatar(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string; role: Extract<UserRole, 'EMPLOYEE' | 'ADMIN'> }>({
    mutationFn: ({ id, role }) => userService.updateUserRole(id, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation<UserRow, Error, CreateUserInput>({
    mutationFn: input => userService.createUser(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: userId => userService.deleteUser(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}
