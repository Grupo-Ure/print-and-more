> ## Documentation Index
> Fetch the complete documentation index at: https://ahasend.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> AhaSend stores all message data in the EU. See /facts.
> The API base URL is https://api.ahasend.com. Send the API key in the Authorization: Bearer header. See /api-reference/authentication.
> Use send.ahasend.com for SMTP. Ports 25, 587 and 2525 use STARTTLS. Port 465 is not supported. See /smtp.
> For send-only integrations, create an API Key v2 under Credentials → Add and scope it to messages:send:{your-domain}. See /send-api/credentials and /api-reference/scopes.

# Send an Email via the API

> Send transactional email with the AhaSend API v2: one POST request to up to 100 recipients with templates, attachments, tracking, tags and scheduled sending.

The AhaSend API creates and sends a message to one or more recipients. This API cannot be used if you want to send a conversational/P2P message and set CC or BCC. Use [Create Conversation Message](https://ahasend.com/docs/api-reference/messages/create-conversation.md) instead. To send a transactional template stored in your account, use [Create Template Message](https://ahasend.com/docs/api-reference/messages/create-template-message.md).

**Validation Requirements:**

* Either `text_content` or `html_content` is required
* `from.email` must be from a domain you own with valid DNS records
* `retention.metadata` must be between 1 and 30 days
* `retention.data` must be between 0 and 30 days
* If `reply_to` is provided, do not include `reply-to` in headers
* `message-id` header will be ignored and automatically generated
* Schedule times must be in RFC3339 format
* `schedule.first_attempt` must be in the future and within 7 days of the request
* `schedule.expires` must be in the future and within 8 days of the request

Authorization uses the domain in `from.email`: either
`messages:send:all` or the matching domain-specific send role is
sufficient.

**Template check:**
Every message is checked with the template engine before it is sent. Content that the check refuses is answered with `400`, and nothing of the request is sent. When the check cannot run right now, the API answers `503` with a `Retry-After` header: send the same request again after that delay. See [API errors](https://ahasend.com/docs/api-reference/errors.md#400-bad-request).

## Related Guides

* Before sending: [verify your sender domain](https://ahasend.com/docs/domains.md).

* [API authentication](https://ahasend.com/docs/api-reference/authentication.md), [Permission scopes](https://ahasend.com/docs/api-reference/scopes.md), [Sending guide](https://ahasend.com/docs/send-api/send-email.md).

* [Message CLI](https://ahasend.com/docs/cli/commands/messages.md), [SMTP settings](https://ahasend.com/docs/smtp.md), [Node.js SDK](https://ahasend.com/docs/guides/nodejs-sdk.md).

* [Go SDK](https://ahasend.com/docs/guides/go-sdk.md), [API errors](https://ahasend.com/docs/api-reference/errors.md), [API rate limits](https://ahasend.com/docs/api-reference/rate-limits.md).

* [Retention rules](https://ahasend.com/docs/retention.md).


## OpenAPI

````yaml openapi.yaml POST /v2/accounts/{account_id}/messages
openapi: 3.1.0
info:
  title: AhaSend API v2
  description: >
    The AhaSend API v2 allows you to send transactional emails, manage domains,
    webhooks, routes, API keys, and view statistics.


    ## Authentication

    All API requests must be authenticated using a Bearer token in the
    Authorization header:

    ```

    Authorization: Bearer aha-sk-64-CHARACTER-RANDOM-STRING

    ```


    ## Scopes

    API keys have specific scopes that control access to different resources and
    actions:


    ### Message Scopes

    - `messages:send:all` - Send messages from any domain in the account

    - `messages:send:{domain}` - Send messages from a specific domain

    - `messages:cancel:all` - Cancel messages from any domain

    - `messages:cancel:{domain}` - Cancel messages from a specific domain

    - `messages:read:all` - Read messages from any domain

    - `messages:read:{domain}` - Read messages from a specific domain


    ### Domain Scopes

    - `domains:read` - Read all domains

    - `domains:write` - Create and update domains

    - `domains:delete:all` - Delete any domain

    - `domains:delete:{domain}` - Delete a specific domain


    ### Account Scopes

    - `accounts:read` - Read account information

    - `accounts:write` - Update account settings

    - `accounts:billing` - Access billing information

    - `accounts:members:read` - Read account members

    - `accounts:members:add` - Add account members

    - `accounts:members:update` - Update account members

    - `accounts:members:remove` - Remove account members


    ### Webhook Scopes

    - `webhooks:read:all` - Read all webhooks

    - `webhooks:read:{domain}` - Read webhooks for a specific domain

    - `webhooks:write:all` - Create and update webhooks

    - `webhooks:write:{domain}` - Create and update webhooks for a specific
    domain

    - `webhooks:delete:all` - Delete any webhook

    - `webhooks:delete:{domain}` - Delete webhooks for a specific domain


    ### Route Scopes

    - `routes:read:all` - Read all routes

    - `routes:read:{domain}` - Read routes for a specific domain

    - `routes:write:all` - Create and update routes

    - `routes:write:{domain}` - Create and update routes for a specific domain

    - `routes:delete:all` - Delete any route

    - `routes:delete:{domain}` - Delete routes for a specific domain


    ### Suppression Scopes

    - `suppressions:read` - Read suppressions

    - `suppressions:write` - Create suppressions

    - `suppressions:delete` - Delete suppressions

    - `suppressions:wipe` - Delete the account's suppressions except protected
    ones (dangerous)


    ### Template Scopes

    - `templates:read` - Read transactional templates, their drafts and their
    published versions, and campaign templates

    - `templates:write` - Create and update transactional templates, and
    publish, discard and restore their drafts; create and update campaign
    templates

    - `templates:delete` - Delete transactional templates and campaign templates


    ### Campaign Scopes

    - `campaigns:read` - Read campaigns, their stats and their recipients

    - `campaigns:write` - Create, update and duplicate campaigns

    - `campaigns:delete` - Delete draft campaigns

    - `campaigns:send` - Send, unschedule and test-send campaigns


    ### Contact Scopes

    - `contacts:read` - Read contacts

    - `contacts:write` - Create and update contacts

    - `contacts:delete` - Delete contacts


    ### Contact lifecycle and attributes

    Contacts are account-global. A contact created through this API joins no

    list on its own; campaigns target lists, so add it to one with the Lists

    endpoints before a campaign can reach it.

    Contact subscription state and suppression records are independent:

    creating, updating, unsubscribing, resubscribing, or deleting a contact

    never creates, changes, or removes complaint, permanent, or protected

    suppressions. Prefer unsubscribe over delete when the goal is only to stop

    marketing mail, because unsubscribe is reversible and preserves contact

    history.


    Writable attribute keys and types come from the account's contact-attribute

    definitions managed in the dashboard; this API does not expose property

    definition CRUD. Writes accept only canonical values for those definitions,

    while reads remain legacy-safe and can return any recursively nested JSON

    value previously stored.


    An email used as `{id_or_email}` is a raw SDK argument and must be

    percent-encoded exactly once as a URL path segment by an HTTP client. For

    example, do not pre-encode `user+tag@example.com` before passing it to an

    SDK that encodes path parameters.


    ### List Scopes

    - `lists:read` - Read lists and list membership

    - `lists:write` - Create and update lists, and add or remove their contacts

    - `lists:delete` - Delete lists


    ### Lists and membership

    A list is a static, private, single opt-in container of contacts, and it is

    what a campaign targets. A membership carries its own `subscription_status`

    (`unconfirmed`, `confirmed`, `unsubscribed`, or `complained`), which is

    per-list consent and is independent of the contact's account-wide

    `unsubscribed` flag. A membership created without a status named is

    `confirmed`, because that is what a campaign reaches. `complained` is the

    mailbox provider's verdict, never writable, and a membership holding it is

    frozen.


    Deleting a list keeps its memberships, so an unsubscribe survives it.

    Removing a contact from a list deletes the membership row and discards that

    record with it, which is why unsubscribing is the reversible way to stop

    marketing mail on one list. Expanding a list's members with

    `include_contacts=true` requires `contacts:read` in addition to

    `lists:read`.


    ### Segment Scopes

    - `segments:read` - Read segments, their members and a contact's segments,
    and preview a definition

    - `segments:write` - Create and update segments

    - `segments:delete` - Delete segments


    ### Segments

    A segment is a saved set of rules over the account's contacts: their

    fields, their list memberships, and the campaigns they received, opened

    or clicked. AhaSend keeps its members up to date as that data changes,

    usually within a minute; rules about campaigns follow within an hour of a

    send, and relative times such as `30 days ago` are read again on a

    schedule. Membership is the rule match only, whatever the contact's

    consent: a campaign to a segment reaches the members who are enabled, not

    unsubscribed, not found invalid, and either confirmed on at least one list

    or on no list at all. A contact who unsubscribed from or complained on

    every list they were on, or has not confirmed a double opt-in, is not

    reached. A contact who unsubscribes from a segment send, or reports it as

    spam, gets no more marketing email from the account.


    ### SMTP Credentials Scopes

    - `smtp-credentials:read:all` - Read all SMTP credentials

    - `smtp-credentials:read:{domain}` - Read SMTP credentials for a specific
    domain

    - `smtp-credentials:write:all` - Create SMTP credentials

    - `smtp-credentials:write:{domain}` - Create SMTP credentials for a specific
    domain

    - `smtp-credentials:delete:all` - Delete any SMTP credentials

    - `smtp-credentials:delete:{domain}` - Delete SMTP credentials for a
    specific domain


    ### Statistics Scopes

    - `statistics-transactional:read:all` - Read all transactional statistics

    - `statistics-transactional:read:{domain}` - Read transactional statistics
    for a specific domain


    ### API Key Scopes

    - `api-keys:read` - Read API keys

    - `api-keys:write` - Create and update API keys

    - `api-keys:delete` - Delete API keys


    ### Sub-Account Scopes

    - `sub-accounts:read` - List and read sub accounts under the parent

    - `sub-accounts:write` - Create and update sub accounts

    - `sub-accounts:delete` - Soft-delete sub accounts

    - `sub-accounts:suspend` - Pause and resume sub accounts, and unpause their
    domains

    - `sub-accounts:usage` - Read per-sub-account usage and allocated cost

    - `sub-account-api-keys:read` - List and read API keys owned by sub accounts

    - `sub-account-api-keys:write` - Create and update API keys owned by sub
    accounts

    - `sub-account-api-keys:delete` - Delete API keys owned by sub accounts


    ## Rate Limiting

    - General API endpoints: 100 requests per second, 200 burst

    - Statistics endpoints: 1 request per second, 1 burst


    A request over the limit gets HTTP 429 with a `Retry-After` header: the

    number of seconds to wait before retrying.


    ## Pagination

    List endpoints use cursor-based pagination with the following parameters:

    - `limit`: Maximum number of items to return (default: 100, max: 100)

    - `after`: Pass `pagination.next_cursor` to fetch the next page

    - `before`: Pass `pagination.previous_cursor` to fetch the previous page


    `after` and `before` are mutually exclusive. A legacy `cursor` query may be

    accepted by parts of the server for backwards compatibility, but it is not

    part of the v2 public contract.


    ## Time Formats

    All timestamps must be in RFC3339 format, e.g., `2023-12-25T10:30:00Z`


    ## Idempotency

    The operations that explicitly declare the optional `Idempotency-Key`

    header support idempotency. Other POST operations do not gain idempotency

    implicitly. When the header is provided:

    - A fresh execution does not return `Idempotent-Replayed`.

    - A completed stored response is replayed with its original status and body
      and `Idempotent-Replayed: true`.
    - An unexpired in-progress execution returns HTTP 409 with
      `Idempotent-Replayed: false` and a positive integer `Retry-After` header.
    - Reusing a key with a different HTTP method, resolved request path, or
      request body returns HTTP 422. That response has neither
      `Idempotent-Replayed` nor `Retry-After`.
    - For ordinary idempotent operations, deterministic 2xx and 4xx outcomes
      produced after the idempotency middleware are stored and replayed.
      Authentication and IP-allow-list failures happen before idempotency and
      are therefore not stored.
    - The two secret-bearing API-key create operations use manual encrypted
      completion. They store and replay a successful 201, including the same
      one-time `secret_key`; a controller-produced 4xx is not stored and leaves
      the key in progress until its execution lease expires.
    - Create Segment and Test Campaign store and replay a 2xx only. A 4xx is
      not stored: it releases the key, so a retry with the same key runs
      again.
    - Server errors (5xx), handler failures, and panics are not stored. The key
      is released so retrying the same request with the same key re-executes it.
      The v2 API does not use an HTTP 412 failed-key tombstone.
    - Idempotency keys for non-secret responses expire after 24 hours.

    - Encrypted API-key creation replay responses expire after 5 minutes.


    ## IP Allow Lists

    Each API key can carry an `ip_allow_list`: a set of source IPs that restrict
    where the key may authenticate from.

    - Entries are CIDR blocks (e.g. `203.0.113.0/24`) or bare IPv4/IPv6
    addresses (stored as a `/32` or `/128`). They are canonicalized and
    de-duplicated; the allow-all prefixes `0.0.0.0/0` and `::/0` are rejected,
    and at most 100 entries are allowed after de-duplication (a longer list is
    rejected with HTTP 400).

    - An empty list (the default) places no restriction.

    - When the list is non-empty, any authenticated request whose client IP is
    not covered by an entry is rejected with HTTP 403 on every v2 endpoint,
    regardless of the key's scopes.

    - Manage the list with the `ip_allow_list` field on the API-key create and
    update endpoints (including the sub-account API-key endpoints).

    - When a key updates its own `ip_allow_list` to a value that excludes the
    caller's current IP, the update is rejected with HTTP 409 to prevent
    self-lockout. Updating a sub-account key from a parent key has no such
    guard.
  version: 2.0.0
  contact:
    email: support@ahasend.com
  license:
    name: MIT
    identifier: MIT
servers:
  - url: https://api.ahasend.com
    description: Production server
security:
  - BearerAuth: []
tags:
  - name: Utility
    description: Utility endpoints for health checks and diagnostics
  - name: API Keys
    description: Manage API keys for authentication and access control
  - name: Domains
    description: Manage sending domains
  - name: Messages
    description: Send and manage transactional messages
  - name: Accounts
    description: Manage account settings and members
  - name: Contacts
    description: Read, create, update, batch upsert, and delete account-global contacts
  - name: Templates
    description: >-
      Create, change, publish and delete the account's transactional templates,
      and read them with their drafts, their published versions and the
      variables a send must supply
  - name: Campaign Templates
    description: >-
      Create, change, read and delete the account's campaign templates, the
      designs a campaign copies when it is made from one
  - name: Campaigns
    description: >-
      Create, change, read, duplicate, delete, test and send the account's
      marketing campaigns, and read their stats and recipients
  - name: Lists
    description: Manage contact lists and the contacts on them
  - name: Segments
    description: >-
      Manage segments, the saved rules that keep a set of contacts up to date,
      and read their members
  - name: Suppressions
    description: Manage email suppressions
  - name: Routes
    description: Manage inbound email routing
  - name: Webhooks
    description: Manage webhook notifications
  - name: SMTP Credentials
    description: Manage SMTP authentication credentials
  - name: Statistics
    description: Access transactional email statistics
  - name: Message Events
    description: Webhooks for outbound message delivery events
  - name: Suppression Events
    description: Webhooks for suppression list changes
  - name: Domain Events
    description: Webhooks for domain configuration issues
  - name: Route Events
    description: Webhooks for inbound email routing
paths:
  /v2/accounts/{account_id}/messages:
    post:
      tags:
        - Messages
      summary: Create Message
      description: >
        Creates and sends a message to one or more recipients. This API cannot
        be used if you want to send a conversational/P2P message and set CC or
        BCC. Use [Create Conversation
        Message](https://ahasend.com/docs/api-reference/messages/create-conversation)
        instead.


        **Validation Requirements:**

        - Either `text_content` or `html_content` is required

        - `from.email` must be from a domain you own with valid DNS records

        - `retention.metadata` must be between 1 and 30 days

        - `retention.data` must be between 0 and 30 days

        - If `reply_to` is provided, do not include `reply-to` in headers

        - `message-id` header will be ignored and automatically generated

        - Schedule times must be in RFC3339 format

        - `schedule.first_attempt` must be in the future and within 7 days of
        the request

        - `schedule.expires` must be in the future and within 8 days of the
        request


        **Headers and subject:**

        - Header names must be visible ASCII with no space and no colon. An
        empty name, or one holding a space, a colon or a line break, is
        rejected.

        - A substitution value that a header uses must not contain a line break.
        Such a request is rejected, and the error names the recipient.

        - A `{{ name }}` in a subject that carries an emoji or an accented
        character is replaced before the message is built, for each recipient
        whose message carries substitutions. Such a subject is rejected when it
        holds template syntax other than `{{ name }}`, when a substitution value
        holds `{{`, `{%` or `{#`, or when the subject and the values combine
        into template syntax. See `subject`.


        Authorization uses the domain in `from.email`: either

        `messages:send:all` or the matching domain-specific send role is

        sufficient.
      operationId: createMessage
      parameters:
        - name: account_id
          in: path
          required: true
          description: Account ID
          schema:
            type: string
            format: uuid
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateMessageRequest'
      responses:
        '202':
          description: Message created successfully
          headers:
            Idempotent-Replayed:
              $ref: '#/components/headers/IdempotentReplayed'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CreateMessageResponse'
        '400':
          description: >
            Bad request. Every message is checked before it is sent. A message
            is refused, and nothing of the request is sent, when its content
            cannot be rendered with a recipient's values, calls `random`,
            `randrange`, `lipsum` or `now`, uses `namespace`, passes a work,
            output, memory or time limit, or has a recipient address the check
            cannot read. The message is `<email>: the message could not be
            rendered: <reason>`, or without `<email>: ` when no recipient had
            started rendering. A refused request with an `Idempotency-Key` gets
            the same answer again for that key.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                render_refused:
                  summary: A recipient's values make the content fail
                  value:
                    message: >-
                      john@example.com: the message could not be rendered:
                      unknown function: nosuch
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '403':
          description: >
            Forbidden. For example, the API key cannot send from the domain, the
            account cannot send, or sending from the domain is paused. A sandbox
            message is accepted from a paused domain.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                domain_paused:
                  summary: Sending from the domain is paused
                  value:
                    message: >-
                      Sending from domain 'example.com' is paused. Check your
                      dashboard for the reason.
        '409':
          $ref: '#/components/responses/IdempotencyConflict'
        '422':
          $ref: '#/components/responses/IdempotencyPayloadMismatch'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '503':
          $ref: '#/components/responses/TemplateCheckBusy'
      security:
        - BearerAuth:
            - messages:send:all
        - BearerAuth:
            - messages:send:{domain}
      x-code-samples:
        - lang: go
          label: AhaSend Go SDK
          source: |
            package main

            import (
              "context"
              "fmt"
              "log"
              "os"

              "github.com/AhaSend/ahasend-go"
              "github.com/AhaSend/ahasend-go/api"
              "github.com/AhaSend/ahasend-go/models/common"
              "github.com/AhaSend/ahasend-go/models/requests"
              "github.com/google/uuid"
            )

            func main() {
              client := api.NewAPIClient(api.WithAPIKey(os.Getenv("AHASEND_API_KEY")))
              accountID := uuid.MustParse(os.Getenv("AHASEND_ACCOUNT_ID"))
              ctx := context.Background()

              // The SDK sends a fresh Idempotency-Key with every POST and reuses it on its
              // own retries. Deriving the key from your own ID instead also makes a rerun
              // of the same job (after a crash, say) return the first send, not a second.
              orderID := "1234"

              response, _, err := client.MessagesAPI.CreateMessage(ctx, accountID, requests.CreateMessageRequest{
                From: common.SenderAddress{
                  Email: "info@example.com",
                  Name:  ahasend.String("Example Corp."),
                },
                Recipients: []common.Recipient{
                  {
                    Email: "john@example.com",
                    Name:  ahasend.String("John Smith"),
                  },
                },
                Subject:     "Hello",
                TextContent: ahasend.String("Hello world!"),
                Sandbox:     ahasend.Bool(true),
              }, api.WithIdempotencyKey("order-"+orderID+"-receipt"))
              if err != nil {
                log.Fatalf("Error sending message: %v", err)
              }
              // Each recipient gets its own message, or an error saying why it was not sent.
              for _, message := range response.Data {
                if message.ID != nil {
                  fmt.Printf("%s: %s\n", message.Recipient.Email, *message.ID)
                } else if message.Error != nil {
                  fmt.Printf("%s: %s\n", message.Recipient.Email, *message.Error)
                }
              }
            }
        - lang: javascript
          label: Node.js 22+ (AhaSend SDK)
          source: >
            import { AhaSendClient } from "@ahasend/sdk";


            const client = AhaSendClient.fromEnv();

            // The SDK sends a fresh Idempotency-Key automatically and reuses it
            on its own retries.

            const result = await client.messages.send({
              from: { email: "sender@example.com", name: "Example" },
              recipients: [{ email: "recipient@example.net" }],
              subject: "Hello from AhaSend",
              html_content: "<p>Hello!</p>",
              sandbox: true,
            });

            console.log("Sandbox message accepted.", { count: result.data.length
            });
components:
  parameters:
    IdempotencyKey:
      name: Idempotency-Key
      in: header
      required: false
      description: >
        Optional idempotency key for safe request retries. Must be a unique
        string for each logical request.

        An identical request with a completed stored outcome returns the
        original status and body. An in-progress

        execution returns 409, a changed method/path/body returns 422, and a
        released 5xx execution may run again.

        Keys for non-secret responses expire after 24 hours. API-key create
        responses include a one-time `secret_key`,

        so successful encrypted replay responses for those operations expire
        after 5 minutes.
      schema:
        type: string
        maxLength: 255
      example: user-12345-create-domain-20240101
  schemas:
    CreateMessageRequest:
      type: object
      required:
        - from
        - recipients
        - subject
      properties:
        from:
          $ref: '#/components/schemas/Address'
        recipients:
          type: array
          items:
            $ref: '#/components/schemas/Recipient'
          minItems: 1
          maxItems: 100
          description: >-
            This does not set the To header to multiple addresses, it sends a
            separate message for each recipient
        reply_to:
          $ref: '#/components/schemas/Address'
          description: >-
            If provided, the reply-to header in headers array must not be
            provided
        subject:
          type: string
          description: >
            Email subject line.


            A `{{ variable }}` in a subject resolves, whatever else the subject
            contains -- an emoji or an accented character included -- for every
            recipient whose message carries substitutions, the request's own
            `substitutions` or that recipient's. A recipient with neither is
            sent nothing to render, so their subject arrives exactly as written,
            braces and all.


            Pad the braces with ordinary spaces: a variable written with
            non-ASCII whitespace inside them is not reliably recognised.


            On a subject that is being resolved and carries an emoji or an
            accented character, template syntax other than a variable -- `{% ...
            %}`, `{# ... #}` or an unclosed brace -- is rejected. A substitution
            value is rejected for any of `{{`, `{%` or `{#`, a `{{ ... }}`
            included, and so is a subject whose values combine into one of them.
        text_content:
          type: string
          description: Plain text content. Required if html_content is empty
        html_content:
          type: string
          description: HTML content. Required if text_content is empty
        amp_content:
          type: string
          description: AMP HTML content
        attachments:
          type: array
          items:
            $ref: '#/components/schemas/Attachment'
          description: >-
            File attachments. For inline images, set the attachment's
            `content_id` to a value wrapped in angle brackets (e.g.
            `<image1@example.com>`) and reference it from `html_content` with
            `cid:` (e.g. `<img src="cid:image1@example.com">`).
        headers:
          type: object
          additionalProperties:
            type: string
          description: >-
            Custom email headers. Each name must be visible ASCII with no space
            and no colon. reply-to header cannot be provided if reply_to is
            provided, message-id will be ignored and automatically generated
        substitutions:
          type: object
          additionalProperties: true
          description: >-
            Global substitutions, recipient substitutions override global. In
            the HTML and AMP bodies, values are HTML-escaped; write `{{
            name|safe }}` to insert a value as HTML. The subject, the headers
            and the text body get values as they are.
        tags:
          type: array
          items:
            type: string
          description: Tags for categorizing messages
        sandbox:
          type: boolean
          description: If true, the message will be sent to the sandbox environment
          default: false
        sandbox_result:
          type: string
          enum:
            - deliver
            - bounce
            - defer
            - fail
            - suppress
          description: The result of the sandbox send
        tracking:
          $ref: '#/components/schemas/Tracking'
          description: >-
            Tracking settings for the message, overrides default account
            settings
        retention:
          $ref: '#/components/schemas/Retention'
          description: >-
            Retention settings for the message, overrides default account
            settings
        schedule:
          $ref: '#/components/schemas/MessageSchedule'
          description: Schedule for message delivery
      example:
        from:
          email: noreply@example.com
          name: Example Corp
        recipients:
          - email: user@example.com
            name: John Doe
        subject: Welcome to Example Corp
        html_content: <h1>Welcome {{first_name}}!</h1>
        text_content: Welcome {{first_name}}!
        substitutions:
          first_name: John
    CreateMessageResponse:
      type: object
      required:
        - object
        - data
      properties:
        object:
          type: string
          enum:
            - list
          description: Object type identifier
        data:
          type: array
          items:
            $ref: '#/components/schemas/CreateSingleMessageResponse'
          description: List of messages and their statuses
    ErrorResponse:
      type: object
      description: |
        Human-readable API error. The server currently sends no stable machine
        error code. In particular, clients must not parse `message` to
        distinguish IP-allow-list, scope, ownership, plan, self-lockout,
        suppression-duplicate, or other errors that share an HTTP status.
      additionalProperties: false
      required:
        - message
      properties:
        message:
          type: string
          description: Error description
      example:
        message: Error message
    Address:
      type: object
      required:
        - email
      properties:
        email:
          type: string
          format: email
          description: >-
            The email address. A `from` address must be on a domain defined in
            your account with valid DNS records.
        name:
          type: string
          description: >-
            The display name shown with the address. It can hold any Unicode
            text; the API encodes it for the header. On a send with
            substitutions or a template, a name with non-ASCII text can use `{{
            name }}` references only; other template syntax in it is refused.
      example:
        email: noreply@example.com
        name: Example Corp
    Recipient:
      type: object
      required:
        - email
      properties:
        email:
          type: string
          format: email
          description: Recipient email address
        name:
          type: string
          description: >-
            Display name for the recipient. It can hold any Unicode text; the
            API encodes it for the header. On a send with substitutions or a
            template, a name with non-ASCII text can use `{{ name }}` references
            only; other template syntax in it is refused.
        substitutions:
          type: object
          additionalProperties: true
          description: >-
            Substitution data for the recipient. Used with jinja2 templating
            language for dynamic content. In the HTML and AMP bodies, values are
            HTML-escaped; write `{{ name|safe }}` to insert a value as HTML. The
            subject, the headers and the text body get values as they are. On a
            template send, to fill a `list` variable, send an array; the
            template's `variables` show the fields each element needs.
      example:
        email: user@example.com
        name: John Doe
        substitutions:
          first_name: John
          order_id: '12345'
    Attachment:
      type: object
      required:
        - data
        - content_type
        - file_name
      properties:
        base64:
          type: boolean
          description: >-
            If true, data must be encoded using base64. Otherwise, data will be
            interpreted as UTF-8
          default: false
        data:
          type: string
          description: >-
            Either plaintext or base64 encoded attachment data (depending on
            base64 field)
        content_type:
          type: string
          description: The MIME type of the attachment
        content_disposition:
          type: string
          description: The disposition of the attachment
        content_id:
          type: string
          description: >
            Content-ID that lets you reference this attachment as an inline
            image from your HTML.


            The value **must be wrapped in angle brackets**, matching the MIME
            `Content-ID` header format — for example `"<image1@example.com>"`.
            Reference it from `html_content` **without** the brackets, e.g.
            `<img src="cid:image1@example.com">`.


            If the angle brackets are omitted, the file is delivered as a
            regular (downloadable) attachment instead of rendering inline.
        file_name:
          type: string
          description: The filename of the attachment
      example:
        base64: true
        data: >-
          iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==
        content_type: image/png
        file_name: pixel.png
    Tracking:
      type:
        - object
        - 'null'
      properties:
        open:
          type:
            - boolean
            - 'null'
          description: Whether to track opens
        click:
          type:
            - boolean
            - 'null'
          description: Whether to track clicks
      example:
        open: true
        click: true
    Retention:
      type:
        - object
        - 'null'
      properties:
        metadata:
          type:
            - integer
            - 'null'
          description: Number of days to retain metadata
          minimum: 1
          maximum: 30
        data:
          type:
            - integer
            - 'null'
          description: Number of days to retain data
          minimum: 0
          maximum: 30
      example:
        metadata: 1
        data: 0
    MessageSchedule:
      type: object
      properties:
        first_attempt:
          type: string
          format: date-time
          description: >-
            The time to make the first attempt for delivering the message. Must
            be RFC3339 format, in the future, and within 7 days of the request.
        expires:
          type: string
          format: date-time
          description: >-
            Expire and drop the message if not delivered by this time. Must be
            RFC3339 format, in the future, and within 8 days of the request.
    CreateSingleMessageResponse:
      type: object
      required:
        - object
        - id
        - recipient
        - status
        - error
      properties:
        object:
          type: string
          enum:
            - message
          description: Object type identifier
        id:
          type:
            - string
            - 'null'
          description: Message ID (null if the message was not sent)
          example: <uuid@example.com>
        recipient:
          allOf:
            - $ref: '#/components/schemas/Recipient'
            - type: object
              required:
                - name
        status:
          type: string
          enum:
            - queued
            - scheduled
            - error
          description: Status of the message
        error:
          type:
            - string
            - 'null'
          description: Error message if the message was not sent
        schedule:
          $ref: '#/components/schemas/MessageSchedule'
          description: Provided if the request contained a schedule
  headers:
    IdempotentReplayed:
      description: >
        Indicates that this response is a stored replay of a previous identical
        request.

        When this header is absent, the response is not a stored replay.
        Ordinary fresh

        responses do not send `false`; that value is reserved for an in-progress
        409.
      schema:
        type: string
        enum:
          - 'true'
    IdempotencyInProgress:
      description: |
        Identifies an idempotency-key execution that is still in progress. This
        header is emitted only on the specialized HTTP 409 response.
      schema:
        type: string
        enum:
          - 'false'
    IdempotencyRetryAfter:
      description: |
        Positive whole number of seconds after which the in-progress execution
        lease may be retried with the same key and unchanged request.
      schema:
        type: integer
        minimum: 1
  responses:
    IdempotencyConflict:
      description: |
        Request in progress. This response always includes
        `Idempotent-Replayed: false` and a positive integer `Retry-After`.
        Clients must use that header tuple, not the human-readable message, to
        distinguish this retryable idempotency state from other HTTP 409s.
      headers:
        Idempotent-Replayed:
          $ref: '#/components/headers/IdempotencyInProgress'
        Retry-After:
          $ref: '#/components/headers/IdempotencyRetryAfter'
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            message: A request with this idempotency key is already in progress
    IdempotencyPayloadMismatch:
      description: |
        Idempotency key was already used with a different HTTP method, resolved
        request path, or request body. This response includes neither
        `Idempotent-Replayed` nor `Retry-After`.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            message: idempotency key was already used with a different request payload
    TemplateCheckBusy:
      description: |
        Every message is checked with the template engine before it is sent,
        and the check could not run right now: the service was busy, or the
        engine failed. Nothing was sent and nothing is known to be wrong with
        the message.
        Send it again after `Retry-After` seconds; on an operation that takes
        an `Idempotency-Key`, send it with the same key.
      headers:
        Retry-After:
          description: Seconds to wait before retrying
          schema:
            type: integer
            minimum: 1
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            message: the message could not be checked right now; try again in a moment
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: aha-sk-64-CHARACTER-RANDOM-STRING
      description: |
        API key for authentication. Non-empty Security Requirement values are
        AhaSend API-key roles. Roles listed within one requirement object are
        jointly required; separate requirement objects are alternatives.

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.