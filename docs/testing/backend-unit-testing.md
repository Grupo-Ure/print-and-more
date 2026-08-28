# Backend Unit Testing Guide

This document defines the required conventions for unit tests in NestJS backends. Unit tests cover controllers and services in isolation — all dependencies are mocked.

---

## What to Test

Every controller endpoint must have tests covering:

1. **Happy path** — valid input, authenticated, correct response shape
2. **Auth failure** — guard rejects the request → `401 Unauthorized`
3. **Bad request** — invalid or missing inputs → `400 Bad Request`

Testing all three is the minimum bar. Do not test things the framework guarantees (e.g., that NestJS wires up routing correctly).

---

## Assertion Style: Black-Box, Schema-First

Assert **status codes and response shapes**, not specific values.

```typescript
// Bad — asserts a specific string, breaks on any data change
expect(response.data.message).toBe("User banned successfully");

// Good — asserts the shape and type
expect(response.status).toBe(200);
expect(response.data).toMatchObject({
  id: expect.any(String),
  is_banned: expect.any(Boolean),
  provider_uid: expect.any(String),
});
```

**Rules:**
- Never assert on error message strings — assert on status codes only
- Use `expect.any(Type)` for fields where the exact value is not under test
- Use `expect.objectContaining({...})` or `toMatchObject({...})` to assert shape without exhaustively listing every field
- When a specific value *is* semantically meaningful (e.g., `is_banned: true` after a ban action), assert it

---

## File Structure

Each controller test file has a companion fixtures file. The fixtures file owns all mock data and factory logic. The test file owns test logic only.

```
src/
  users/
    users.controller.ts
    users.controller.spec.ts          ← test logic only
    users.controller.fixtures.ts      ← mock data factories
  stripe/
    stripe.controller.ts
    stripe.controller.spec.ts
    stripe.controller.fixtures.ts
  admin/
    admin.controller.ts
    admin.controller.spec.ts
    admin.controller.fixtures.ts
```

---

## Fixtures File

The fixtures file exports factory functions and mock builder helpers. It must not contain any test logic (`describe`, `it`, `expect`).

### What belongs here

- Factory functions that generate mock entities (User, Subscription, etc.)
- Factory functions that generate mock service objects (pre-wired with `jest.fn()`)
- Shared constants for auth provider payloads
- Guard override factories

### Example: `users.controller.fixtures.ts`

```typescript
import { ExecutionContext } from "@nestjs/common";
import { AuthUser } from "./guards/jwt-auth.guard";

// --- Entities ---

export function mockUser(overrides: Partial<ReturnType<typeof mockUser>> = {}) {
  return {
    id: "mock-user-id",
    provider_uid: "mock-provider-uid",
    name: null,
    email: null,
    stripe_customer_id: null,
    subscription_tier_id: "mock-subscription-id",
    is_banned: false,
    subscription_granted_by_admin: false,
    granted_subscription_id: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function mockUserWithSubscriptions(
  overrides: Partial<ReturnType<typeof mockUser>> = {},
) {
  return {
    ...mockUser(overrides),
    subscription_tier: mockSubscription(),
    granted_subscription: null,
  };
}

export function mockSubscription(overrides = {}) {
  return {
    id: "mock-sub-id",
    name: "basic",
    stripe_product_id: null,
    ...overrides,
  };
}

// --- Auth payloads ---

export const authUserPayload: AuthUser = {
  userId: "mock-provider-uid",
  orgId: "mock-org-id",
};

// --- Guard overrides ---

export function jwtGuardAllow() {
  return {
    canActivate: jest.fn((ctx: ExecutionContext) => {
      ctx.switchToHttp().getRequest().user = authUserPayload;
      return true;
    }),
  };
}

export function jwtGuardDeny() {
  return {
    canActivate: jest.fn(() => {
      throw new UnauthorizedException();
    }),
  };
}

// --- Service mocks ---

export function mockUsersService() {
  return {
    upsertByProviderUid: jest.fn(),
    findOneWithSubscriptions: jest.fn(),
    findByProviderUid: jest.fn(),
    findAll: jest.fn(),
    banUser: jest.fn(),
    unbanUser: jest.fn(),
  };
}
```

> Keep mock values stable (not random) in unit tests. Randomness belongs in integration tests via `TestDataGenerator`. Stable values make failures easy to read.

---

## Test File

The test file imports everything it needs from the fixtures file. It focuses entirely on test logic.

### Module setup helper

Define a `buildModule` helper at the top of each test file. This eliminates repetition when testing auth and bad-request paths, which require different guard configurations.

```typescript
import { Test } from "@nestjs/testing";
import { HttpStatus } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import {
  mockUser,
  mockUserWithSubscriptions,
  mockUsersService,
  authUserPayload,
  jwtGuardAllow,
  jwtGuardDeny,
} from "./users.controller.fixtures";

async function buildModule(guardOverride = jwtGuardAllow()) {
  const module = await Test.createTestingModule({
    controllers: [UsersController],
    providers: [{ provide: UsersService, useValue: mockUsersService() }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(guardOverride)
    .compile();

  return {
    controller: module.get(UsersController),
    service: module.get<ReturnType<typeof mockUsersService>>(UsersService),
  };
}
```

### Test cases

```typescript
describe("UsersController", () => {
  describe("POST /api/users/login", () => {
    it("returns the user on success", async () => {
      const { controller, service } = await buildModule();
      const user = mockUserWithSubscriptions();
      service.upsertByProviderUid.mockResolvedValue(mockUser());
      service.findOneWithSubscriptions.mockResolvedValue(user);

      const result = await controller.login(authUserPayload);

      expect(result).toMatchObject({
        id: expect.any(String),
        provider_uid: expect.any(String),
        is_banned: expect.any(Boolean),
        subscription_tier: expect.any(Object),
      });
      expect(service.upsertByProviderUid).toHaveBeenCalledWith(authUserPayload.userId);
    });

    it("returns 401 when auth fails", async () => {
      const { controller } = await buildModule(jwtGuardDeny());

      await expect(controller.login(authUserPayload)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });
  });
});
```

---

## Testing Authentication Failures

Override the guard to throw `UnauthorizedException` — the same exception the real guard throws. Do not test the guard's internal logic in controller tests; the guard has its own test.

```typescript
// In fixtures file
import { UnauthorizedException, ForbiddenException } from "@nestjs/common";

export function jwtGuardDeny() {
  return { canActivate: jest.fn(() => { throw new UnauthorizedException(); }) };
}

export function clerkGuardDeny() {
  return { canActivate: jest.fn(() => { throw new UnauthorizedException(); }) };
}
```

---

## Testing Bad Request Errors

For controller unit tests, the `ValidationPipe` is **not active** (it's a global pipe applied at bootstrap, not in `Test.createTestingModule`). This means you cannot test DTO validation at the controller unit level — that is covered by integration tests.

At the unit level, test bad-request scenarios by mocking the service to throw a `BadRequestException` or `NotFoundException`:

```typescript
it("returns 404 when user does not exist", async () => {
  const { controller, service } = await buildModule();
  service.findByProviderUid.mockRejectedValue(new NotFoundException());

  await expect(controller.banUser("nonexistent-uid")).rejects.toMatchObject({
    status: HttpStatus.NOT_FOUND,
  });
});
```

DTO validation testing belongs in integration tests, where the full NestJS pipeline (including `ValidationPipe`) is active.

---

## Naming Tests

Use plain English, not code:

```typescript
// Bad
it("should call upsertByProviderUid with userId and return result", ...);

// Good
it("returns the user on success", ...);
it("returns 401 when auth fails", ...);
it("returns 404 when user does not exist", ...);
```

---

## Anti-Patterns

| Anti-pattern | Why | Instead |
|---|---|---|
| Defining mock objects inline in test files | Duplicates data, breaks when shape changes | Use fixtures factory functions |
| Asserting specific error message strings | Brittle, breaks on wording changes | Assert `status` only |
| Asserting every field with exact values | Over-specified, couples test to implementation | Use `toMatchObject` with `expect.any()` |
| Testing guard internals in controller tests | Wrong scope | Guards have their own spec files |
| Random values in unit test fixtures | Makes failures hard to read | Use stable values; random belongs in integration tests |
| Calling `controller.login(...)` without setting up the guard | Skips the real auth path under test | Always set up the guard override explicitly |
