/** Sentinel for "no assignee" in the order sidebar's users filter (assignee_id is otherwise a user uuid). */
export const UNASSIGNED_ASSIGNEE = 'UNASSIGNED' as const
export type AssigneeFilterValue = string | typeof UNASSIGNED_ASSIGNEE
