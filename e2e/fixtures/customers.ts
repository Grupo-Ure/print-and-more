/**
 * The customer every per-test order is created for. Created and removed
 * together with the order (see fixtures/orders.ts), so it exists only while
 * a test that asked for an order is running.
 */
export const TEST_CUSTOMER = {
  name: 'E2E Customer',
  email: 'customer@e2e.local',
} as const

export type TestCustomer = typeof TEST_CUSTOMER
