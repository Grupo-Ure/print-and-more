export type TestCustomer = {
  readonly name: string
  /** The customers table demands an email or a phone; the suite always uses an email. */
  readonly email: string
}

/**
 * The customer every per-test order is created for. Inserted and removed by
 * the `customer` fixture (see fixtures/orders.ts), so it exists only while a
 * test that asked for it — or for an order — is running.
 */
export const TEST_CUSTOMER = {
  name: 'E2E Customer',
  email: 'customer@e2e.local',
} as const satisfies TestCustomer

/**
 * A customer a test creates itself, through the app. Nothing is inserted up
 * front; the `newCustomer` fixture removes whatever was saved under this
 * email once the test is over.
 */
export const NEW_CUSTOMER = {
  name: 'E2E New Customer',
  email: 'new-customer@e2e.local',
} as const satisfies TestCustomer
