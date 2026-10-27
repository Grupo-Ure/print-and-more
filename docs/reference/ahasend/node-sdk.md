> ## Documentation Index
> Fetch the complete documentation index at: https://ahasend.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> AhaSend stores all message data in the EU. See /facts.
> The API base URL is https://api.ahasend.com. Send the API key in the Authorization: Bearer header. See /api-reference/authentication.
> Use send.ahasend.com for SMTP. Ports 25, 587 and 2525 use STARTTLS. Port 465 is not supported. See /smtp.
> For send-only integrations, create an API Key v2 under Credentials → Add and scope it to messages:send:{your-domain}. See /send-api/credentials and /api-reference/scopes.

# Node.js and TypeScript Email SDK

> Official AhaSend Node.js and TypeScript SDK (@ahasend/sdk): install, send email, configure retries and idempotency, handle errors, verify webhooks.

The AhaSend Node.js and TypeScript SDK lets you send email, handle recipient results and verify webhooks; this guide covers installation and the client options.

This page is the SDK reference. To wire it into a specific framework, pick a guide from the sidebar.

Use a **send-only key** from **Credentials → Add → API Key v2** with `messages:send:{your-domain}`. Use `messages:send:all` when sending from many domains. For management tasks such as creating a webhook, use a separate **full key** from **Account Settings → API Keys** with the needed [scopes](https://ahasend.com/docs/api-reference/scopes.md). See [send-only credentials](https://ahasend.com/docs/send-api/credentials.md) and [authentication](https://ahasend.com/docs/api-reference/authentication.md).

Keep credentials on the server. Use [sandbox mode](https://ahasend.com/docs/send-api/sandbox.md) for tests. Reuse a stable, business-event idempotency key only with the exact same payload; use different keys for sandbox and live sends. Check every recipient's status and return a failure when any item is `error`; HTTP 202 alone does not mean every recipient was accepted.

For webhooks, verify the raw request bytes using the full secret as the raw UTF-8 HMAC key, including its `aha-whsec-` or `aha-rsec-` prefix. Never base64-decode the secret. The AhaSend SDK verifiers handle this. These examples use a 30,000,000-byte webhook body limit; a hosting platform may impose a smaller limit. Acknowledge verified unknown event types with 2xx. See [verification](https://ahasend.com/docs/api-reference/webhooks/security.md) and [retry policy](https://ahasend.com/docs/api-reference/webhooks/retry-policy.md).

## Install

The SDK is v0.x; pin an exact version in production. The examples were checked with `@ahasend/sdk` 0.2.1 (Node.js 22+).

```bash npm theme={null}
npm install @ahasend/sdk
```

```bash pnpm theme={null}
pnpm add @ahasend/sdk
```

```bash yarn theme={null}
yarn add @ahasend/sdk
```

```bash bun theme={null}
bun add @ahasend/sdk
```

## Try a Sandbox Send

Run this short SDK check locally before adding the longer server integration below. Use a [verified sender](https://ahasend.com/docs/domains.md), a [send-only API key](https://ahasend.com/docs/send-api/credentials.md), and your account ID. It sends to a reserved test address with `sandbox: true`, so no email is delivered.

In the server project directory, add `.env` to `.gitignore`, then create `.env` with `AHASEND_API_KEY`, `AHASEND_ACCOUNT_ID`, and `AHASEND_FROM` (an address on your verified domain). Keep these values out of browser code and AI prompts. Use Node.js 22 or newer. Save this as `quick-send.mjs`:

```js quick-send.mjs theme={null}
import { AhaSendClient } from "@ahasend/sdk";
try {
  const client = AhaSendClient.fromEnv();
  const result = await client.messages.send({
    from: { email: process.env.AHASEND_FROM },
    recipients: [{ email: "recipient@example.com" }],
    subject: "My first sandbox email",
    text_content: "Hello from AhaSend",
    sandbox: true,
  });
  const statuses = result.data.map((entry) => entry.status);
  console.log({ statuses });
  if (!statuses.length || statuses.some((s) => !["queued", "scheduled"].includes(s)))
    throw new Error("A recipient was rejected");
} catch {
  console.error("Sandbox send failed; check your credentials, sender and account.");
  process.exitCode = 1;
}
```

Run `node --env-file=.env quick-send.mjs` from that directory. The output lists each recipient status; `queued` or `scheduled` means accepted for sandbox processing. The process exits with a failure if the request or any recipient fails. Continue below for the full integration.

## Runtime Compatibility

| Runtime | Supported versions |
| - | - |
| Node.js | 22, 24, and 26 |
| Deno | Latest 2.x |
| Bun | Latest |
| Cloudflare workerd | Supported without `nodejs_compat` |
| Vercel Edge | Supported |

TypeScript declarations ship with the package, so there is no SDK-specific `@types` package to add. Resolve them with `moduleResolution` set to `bundler`, `node16`, or `nodenext`; the package `exports` map is what makes `@ahasend/sdk/webhooks` resolvable. The declarations also name four WHATWG globals a fetch client cannot hide — `fetch`, `Request`, `Response`, and `AbortSignal` — so your project needs either `@types/node` or `"lib": ["DOM"]`. With neither, compilation fails inside `node_modules` rather than in your own code.

> [!WARNING]
>
> Browsers and browser Service Workers are refused, because the API key grants full send access and anything the browser can read, a visitor can read. `dangerouslyAllowBrowser: true` exists only for browser-shaped server test environments.

## Send Your First Email

Create a [least-privilege API key](https://ahasend.com/docs/send-api/credentials.md) with `messages:send:{your-domain}`, and keep the key and account ID in an uncommitted `.env` file or your deployment secret store.

```js send.mjs theme={null}
import { AhaSendClient } from "@ahasend/sdk";

const ahasend = new AhaSendClient({
  apiKey: process.env.AHASEND_API_KEY,
  accountId: process.env.AHASEND_ACCOUNT_ID,
});

const result = await ahasend.messages.send({
  from: { email: "hello@yourdomain.com", name: "Your App" },
  recipients: [{ email: "user@example.com", name: "Jane" }],
  subject: "Welcome to Your App",
  html_content: "<h1>Welcome aboard</h1>",
  text_content: "Welcome aboard",
  sandbox: true, // validates and queues without delivering
});

const accepted = result.data.filter((entry) =>
  entry.status === "queued" || entry.status === "scheduled"
);
const rejected = result.data.length - accepted.length;
if (rejected > 0 || accepted.length === 0) {
  console.error("AhaSend rejected recipients", { count: rejected });
  process.exitCode = 1;
} else {
  console.log("Sandbox messages accepted", { count: accepted.length });
}
```

Run it with `node --env-file=.env send.mjs`. Change `sandbox` to `false` only after you have intentionally reviewed the sender, recipients, and production credentials.

Note what the result handling is doing. `recipients` takes up to 100 addresses and each one becomes its own message, so `result.data` holds one entry per recipient. A single recipient can come back `status: "error"` with a null `id`, a suppressed address for instance, while the call itself succeeds. Reading `data[0]` would miss that.

Body fields are snake\_case, matching the API. Beyond the ones above: `reply_to`, `attachments`, `headers`, `substitutions`, `tags`, `tracking`, `retention`, and `schedule`. For one conversation message with visible To and Cc recipients and hidden Bcc recipients, use `messages.sendConversation()` instead.

> [!TIP]
>
> `sandbox_result` rehearses a specific outcome: `deliver`, `bounce`, `defer`, `fail`, or `suppress`. Each one fires the matching webhook, so you can test your bounce handling without a real bounce. See [Sandbox Mode](https://ahasend.com/docs/send-api/sandbox.md).

## Configure the Client

Build the client once at module scope and share it. Client-level retry, telemetry, idempotency, and local rate-pacing configuration then stays consistent, and any enabled pacing queue is shared by your handlers in that process.

```ts lib/ahasend.ts theme={null}
import { AhaSendClient } from "@ahasend/sdk";

export const ahasend = new AhaSendClient({
  apiKey: process.env.AHASEND_API_KEY!,
  accountId: process.env.AHASEND_ACCOUNT_ID!,
});
```

`AhaSendClient.fromEnv()` builds the same client from `AHASEND_API_KEY` (or `AHASEND_TOKEN`) and `AHASEND_ACCOUNT_ID`, along with the other `AHASEND_*` variables. It reads `process.env` by default and accepts a string record instead. In Cloudflare Workers, use the [explicit constructor with bound fetch](https://ahasend.com/docs/guides/cloudflare-workers.md#send-an-email-from-a-worker) shown in the Worker guide; it passes `fetch.bind(globalThis)` along with the credential bindings.

| Option | Default | Purpose |
| - | - | - |
| `apiKey` | required | Your API key |
| `accountId` | required | Account UUID, one client per account |
| `baseUrl` | `https://api.ahasend.com` | HTTPS enforced, localhost exempted |
| `timeoutMs` | `30_000` | Per-attempt timeout in milliseconds |
| `retry` | enabled, 3 retries | Exponential backoff with jitter |
| `rateLimit` | disabled | Opt-in local request pacing |
| `idempotency` | auto-generate | Idempotency key behaviour on create operations |
| `fetch` | `globalThis.fetch` | Inject your own fetch implementation |
| `hooks` | none | `onRequest`, `onResponse`, `onRetry`, `onError` telemetry |
| `debug` | `false` | Console diagnostics; leave disabled where logs must follow the safe allowlist below |

Every method also takes a trailing options object:

```ts theme={null}
await ahasend.messages.send(body, {
  idempotencyKey: `order-${orderId}`, // drive the key from your own identifier
  timeoutMs: 5_000, // override the per-attempt timeout
  retry: { maxRetries: 1 }, // restrict retries, or false to disable
  signal: AbortSignal.timeout(10_000), // cancel the request
  headers: { "x-trace-id": traceId },
});
```

## Errors

Every non-2xx response throws a typed error:

```ts theme={null}
import { AhaSendAPIError, AhaSendRateLimitError } from "@ahasend/sdk";

try {
  await ahasend.messages.send(body);
} catch (err) {
  if (err instanceof AhaSendRateLimitError) {
    console.warn(`Rate limited, retry after ${err.retryAfterSeconds}s`);
  } else if (err instanceof AhaSendAPIError) {
    console.error(`AhaSend error ${err.status} (request ${err.requestId})`);
  } else {
    throw err;
  }
}
```

`AhaSendError` is the root. `AhaSendAPIError` carries `.status`, `.code`, `.requestId`, and `.body`, and branches into `AhaSendBadRequestError`, `AhaSendAuthenticationError`, `AhaSendPermissionError`, `AhaSendNotFoundError`, `AhaSendConflictError`, `AhaSendIdempotencyConflictError`, `AhaSendUnprocessableEntityError`, `AhaSendIdempotencyMismatchError`, `AhaSendRateLimitError`, and `AhaSendServerError`. Alongside it sit `AhaSendConnectionError` with its `AhaSendTimeoutError` subclass, plus `AhaSendAbortError`, `AhaSendConfigurationError`, `AhaSendRateLimitQueueFullError`, `AhaSendResponseTooLargeError`, and `AhaSendResponseParseError`.

Match on `error.code` or `error.status`, never on message text. Logs, metrics, traces, and exception tags should allowlist only aggregate counts, appropriate opaque IDs, HTTP status, SDK error code, and request ID. Do not serialize whole requests, responses, events, or errors, and do not log `.body`, `.message`, credentials, addresses, content, or idempotency keys.

## Retries and Idempotency

The SDK retries only when the generated operation profile marks the call safe, idempotent, or protected by an idempotency key. For an eligible call it retries `408`, `429`, `5xx`, network failures, timeouts, and an idempotency-in-progress `409` carrying the required replay and retry headers. Caller cancellation and other `4xx` responses are terminal. Create operations declared idempotent receive an automatically generated UUID `Idempotency-Key`, which is reused across the logical call's internal retries.

> [!NOTE]
>
> Stored responses replay for 24 hours, covering 2xx and deterministic 4xx responses. The two API-key create operations are the exception: their replay carries the same one-time `secret_key` for only 5 minutes, so persist that value the moment it arrives. Server errors are not stored, so the same key can execute again after a `5xx`. Pass your own `idempotencyKey` derived from a stable business identifier when your application may retry later, reuse it only with the exact same payload, and reconcile an uncertain result before another send when duplicates are unacceptable.

Local rate pacing is separate and off by default. Turn it on with `rateLimit: { enabled: true }`.

## Resources

| Resource | Methods |
| - | - |
| `client.messages` | `send`, `sendConversation`, `list`, `iterate`, `get`, `cancel` |
| `client.domains` | `list`, `iterate`, `create`, `get`, `update`, `delete`, `checkDns` |
| `client.apiKeys` | `list`, `iterate`, `create`, `get`, `update`, `delete` |
| `client.webhooks` | `list`, `iterate`, `create`, `get`, `update`, `delete` |
| `client.statistics` | `deliverability`, `bounces`, `deliveryTimes` |
| `client.suppressions` | `list`, `iterate`, `create`, `delete`, `wipe` |
| `client.routes` | `list`, `iterate`, `create`, `get`, `update`, `delete` |
| `client.accounts` | `get`, `update`, `listMembers`, `addMember`, `removeMember` |
| `client.smtpCredentials` | `list`, `iterate`, `create`, `get`, `delete` |
| `client.subAccounts` | `list`, `iterate`, `create`, `usage`, `get`, `update`, `delete`, `suspend`, `unsuspend`; nested `apiKeys` has `list`, `iterate`, `create`, `get`, `update`, `delete` |
| `client.ping()` | Health check |

List endpoints paginate. Take a page at a time with `list()`, or let `iterate()` walk everything lazily:

```ts theme={null}
for await (const message of ahasend.messages.iterate({ status: "Delivered" })) {
  // pages are fetched as needed
}
```

## Webhooks

`@ahasend/sdk/webhooks` is a separate entry point holding the Standard Webhooks HMAC-SHA256 verifier, typed parsers for webhook and inbound route event types, and adapters for Express, Fastify, and Next.js. It does not pull in the API client.

```ts theme={null}
import {
  AhaSendWebhookVerificationError,
  WebhookVerifier,
  isKnownWebhookEvent,
  type AnyWebhookEvent,
  type WebhookHeadersInput,
} from "@ahasend/sdk/webhooks";

const verifier = new WebhookVerifier(process.env.AHASEND_WEBHOOK_SECRET!);

// `rawBody` is the bounded raw read your framework already performed.
export async function handleWebhook(
  headers: WebhookHeadersInput,
  rawBody: Uint8Array,
): Promise<number> {
  let event: AnyWebhookEvent;
  try {
    event = await verifier.parse(headers, rawBody);
  } catch (err) {
    if (!(err instanceof AhaSendWebhookVerificationError)) throw err;
    // Answer with an empty body: `err.reason` names the check that failed and
    // is yours to act on, not something to hand back to the sender.
    return err.reason === "body_too_large" ? 413 : 400;
  }

  if (isKnownWebhookEvent(event)) {
    switch (event.type) {
      case "message.delivered":
        break;
      case "message.bounced":
        break;
    }
  }

  return 202;
}
```

> [!WARNING]
>
> `parse()` and `verify()` are asynchronous. Await them before treating the body as trusted. The Express, Fastify, and Next.js adapters await verification internally.

Verification needs the **raw request body**, the exact bytes AhaSend sent. If a JSON body parser runs first the signature can no longer be checked: `expressWebhookHandler` hands that to `next`, `fastifyWebhookHandler` answers an opaque `400`, and `nextRouteHandler` reads and bounds the stream itself. Pass the webhook secret exactly as the dashboard shows it, `aha-whsec-` prefix included. Every adapter answers a failed verification with an empty `400`, or `413` when the body was too large, so nothing about the failed check reaches the sender.

Timestamp checking rejects any delivery more than five minutes from your clock, adjustable with `new WebhookVerifier(secret, { toleranceSeconds })`, but it does not deduplicate a valid one replayed inside that window. After verification, atomically commit each `webhook-id` together with durable work or an outbox record. A unique ID insert by itself can lose an event if the process stops before performing the side effect. Acknowledge duplicates without enqueuing again, retry storage failures with a non-`2xx` response, and process the durable work idempotently outside the request.

Direct verification and every adapter enforce a fixed 30,000,000-byte body ceiling. Adapters buffer the whole body before verifying it, and decoding it costs more memory again, so narrow that ceiling to what your payloads actually need: `maxBodyBytes` is a trailing option on `expressWebhookHandler`, `fastifyWebhookHandler`, and `nextRouteHandler`, and it only lowers the fixed limit, never raises it. `WebhookVerifier` takes no such option — on the direct path above, bound the read that produces `rawBody` yourself. Either way, set matching request-size and concurrency limits at the reverse proxy.

## Framework Guides

The JavaScript and TypeScript guides use this SDK. The Go framework cards use the [Go SDK](https://ahasend.com/docs/guides/go-sdk.md).

> **[Express](https://ahasend.com/docs/guides/express.md)**

> **[Fastify](https://ahasend.com/docs/guides/fastify.md)**

> **[NestJS](https://ahasend.com/docs/guides/nestjs.md)**

> **[Next.js](https://ahasend.com/docs/guides/nextjs.md)**

> **[Nuxt](https://ahasend.com/docs/guides/nuxt.md)**

> **[SvelteKit](https://ahasend.com/docs/guides/sveltekit.md)**

> **[Hono](https://ahasend.com/docs/guides/hono.md)**

> **[Koa](https://ahasend.com/docs/guides/koa.md)**

> **[ElysiaJS](https://ahasend.com/docs/guides/elysiajs.md)**

> **[Encore.ts](https://ahasend.com/docs/guides/encore.md)**

> **[Remix / React Router](https://ahasend.com/docs/guides/remix.md)**

> **[Astro](https://ahasend.com/docs/guides/astro.md)**

> **[Vite](https://ahasend.com/docs/guides/vite.md)**

> **[Gin (Go)](https://ahasend.com/docs/guides/gin.md)**

> **[Echo (Go)](https://ahasend.com/docs/guides/echo.md)**

> **[Fiber (Go)](https://ahasend.com/docs/guides/fiber.md)**

> **[chi (Go)](https://ahasend.com/docs/guides/chi.md)**

> **[gorilla/mux (Go)](https://ahasend.com/docs/guides/gorilla-mux.md)**

Every other framework, runtime, and platform is in the sidebar. Building in Go instead? See the [Go SDK](https://ahasend.com/docs/guides/go-sdk.md).

## Source and Support

MIT licensed, developed at [github.com/AhaSend/ahasend-ts](https://github.com/AhaSend/ahasend-ts). Report reproducible bugs as GitHub issues, without credentials, message content, or webhook payloads.

Use [Nodemailer over SMTP](https://ahasend.com/docs/smtp/nodejs.md) if your Node.js app already has an SMTP mailer.

## Related Guides

* Before sending: [verify a domain](https://ahasend.com/docs/domains.md) and [create a send-only key](https://ahasend.com/docs/send-api/credentials.md).
* Other ways to send: [REST API](https://ahasend.com/docs/send-api/send-email.md), [SMTP](https://ahasend.com/docs/smtp.md), [CLI quickstart](https://ahasend.com/docs/cli/quickstart.md), [Node.js SDK](https://ahasend.com/docs/guides/nodejs-sdk.md) and [Go SDK](https://ahasend.com/docs/guides/go-sdk.md).
* Request rules: [API authentication](https://ahasend.com/docs/api-reference/authentication.md), [scopes](https://ahasend.com/docs/api-reference/scopes.md), [idempotency](https://ahasend.com/docs/api-reference/idempotency.md), [errors](https://ahasend.com/docs/api-reference/errors.md) and [rate limits](https://ahasend.com/docs/api-reference/rate-limits.md).
* Testing and events: [sandbox mode](https://ahasend.com/docs/send-api/sandbox.md), [CLI webhook testing](https://ahasend.com/docs/cli/webhook-testing.md), [event payloads](https://ahasend.com/docs/api-reference/webhooks.md), [signature verification](https://ahasend.com/docs/api-reference/webhooks/security.md) and [delivery retries](https://ahasend.com/docs/api-reference/webhooks/retry-policy.md).
* Data and limits: [retention](https://ahasend.com/docs/retention.md), [tracking](https://ahasend.com/docs/tracking/open-tracking.md) and [plans and feature availability](https://ahasend.com/docs/facts.md#plans-and-features).


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.