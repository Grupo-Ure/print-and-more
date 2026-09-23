export type TestCustomer = {
  readonly name: string
  /** The customers table demands an email or a phone; the suite always uses an email. */
  readonly email: string
  readonly phone?: string
  readonly street?: string
  readonly houseNumber?: string
  readonly postalCode?: string
  readonly city?: string
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
 * The same customer with every contact and address field filled, for what the
 * app shows of a customer. Override per describe block with
 * `test.use({ customerSeed: FULL_CUSTOMER })`.
 */
export const FULL_CUSTOMER = {
  ...TEST_CUSTOMER,
  phone: '+49 30 1234567',
  street: 'Main Street',
  houseNumber: '12a',
  postalCode: '12345',
  city: 'Springfield',
} as const satisfies TestCustomer

/** FULL_CUSTOMER's address as the app shows it on one line: street and number, then postal code and city. */
export const FULL_CUSTOMER_ADDRESS = `${FULL_CUSTOMER.street} ${FULL_CUSTOMER.houseNumber}, ${FULL_CUSTOMER.postalCode} ${FULL_CUSTOMER.city}`

/**
 * A customer a test creates itself, through the app. Nothing is inserted up
 * front; the `newCustomer` fixture removes whatever was saved under this
 * email once the test is over.
 */
export const NEW_CUSTOMER = {
  name: 'E2E New Customer',
  email: 'new-customer@e2e.local',
} as const satisfies TestCustomer
