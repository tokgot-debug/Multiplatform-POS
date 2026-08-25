# Legacy-to-Next migration audit

Audit date: 2026-08-24  
Legacy reference: `legacy/vanilla-pos`  
Target applications: `frontend` (Next.js) and `backend/functions` (Firebase Functions)

## Executive verdict

The migration is **not feature-complete**. The current repository is a sounder
security and data foundation than the browser-only legacy demo, but it is not a
drop-in replacement for the reachable legacy workflows.

- The Next.js app has routes corresponding to all 12 live legacy sidebar tabs.
- Of those routes, 0 have full behavioral parity, 2 are partial (Till and
  Settings), 9 are read-only, and Tools is a non-parity readiness stub.
- Only PIN unlock, checkout, and tenant-settings edits have repository mutation
  contracts. Most other routes are read-only projections.
- Firebase mode cannot yet be operated end-to-end without manually provisioned
  Auth users, custom claims, Firestore documents, PIN hashes, and an open shift.
- Non-cash production checkout cannot complete because no provider webhook creates
  verified `payment_intents`, and the checkout UI does not collect a verified
  reference.
- eTIMS submission, stock workflows, shift workflows, staff/catalog administration,
  detailed receipts, exports, public menu ordering, and offline operation are not
  migrated.
- Legacy Procurement and Management Reports contain substantial code but were never
  imported or mounted. They are recorded as dormant product intentions, not live
  behavior that can be claimed as parity.

The correct status label for the target is **migration foundation / partial parity**.

## Status definitions

- **Carried**: the meaningful behavior exists in the target and has a production
  data path.
- **Partial**: a meaningful subset exists, but material behavior is absent.
- **Read-only**: the route presents migrated data but the legacy workflow cannot be
  performed.
- **Missing**: no equivalent user workflow exists.
- **Redesign**: the legacy behavior was simulated, broken, or unsafe and must be
  replaced rather than copied.

## Reachable screen parity

| Legacy surface | Target | Status | Audit result |
| --- | --- | --- | --- |
| PIN user switch / lock | Global POS session | Partial | Mock PIN unlock works. Firebase unlock requires an already authenticated Firebase identity whose `tenant_id` and `staff_id` claims exactly match the selected profile. There is no Firebase sign-in or provisioning flow. Five-attempt server lockout is an improvement. |
| Till / checkout | `/till` | Partial | Product/category/barcode-text search, customer, table, buyer PIN, cart, authoritative price/tax, exact tender total, HOUSE stock deduction, receipt confirmation, and atomic sale writes exist. Missing: scanner action, wholesale pricing, batch/FEFO, park/resume, credit, split tender UI, cash tender/change, provider initiation, detailed fiscal receipt, print, and 58/80 mm formats. |
| Orders Viewer | `/orders` | Read-only | Sales ledger and summary metrics exist. Missing search, staff/payment/fiscal filters, invoice detail, receipt rendering, print, and CSV export. |
| Shift Management | `/shifts` | Read-only | Shift records and totals render. Missing open, pay-in, pay-out, X report, cash-up, close, and persisted Z report. No backend shift callable exists. |
| Inventory / Menu Admin | `/inventory` | Read-only | Product, price, tax, eTIMS metadata, and aggregate stock render. Missing product/category/barcode CRUD, image upload, eTIMS item registration, adjustments, stock take, batch tracking, and expiry exposure. |
| M-Pesa | `/mpesa` | Read-only | Existing mobile-payment records render. Missing STK initiation, callback/webhook verification, query/reconciliation, retry, and payment-intent creation. The legacy Daraja flow was only an in-memory simulator and must be redesigned. |
| Store Stock | `/store-stock` | Read-only | STORE balances render. Missing delivery receipt, absolute adjustment, requisition approval, issue, and paired Store-to-House movements. |
| House Stock | `/house-stock` | Read-only | HOUSE balances and low-stock state render. Missing stock request creation and lifecycle tracking. |
| Users | `/users` | Read-only | Staff profiles, roles, and statuses render without PIN exposure. Missing Auth-user/custom-claim provisioning, create/edit/suspend, role assignment, and PIN rotation. |
| Audit Logs | `/audit-logs` | Read-only / redesigned | Server-owned events render. Missing filters and integrity verification. The legacy browser hash chain was not trustworthy; a production integrity/retention design is still required. Production settings updates currently create no audit event. |
| Financials & AI | `/finance` | Read-only | Revenue, tax, discounts, payment mix, and top products are calculated from canonical target records. Missing date range, COGS/margin, VAT3, export, and assistant. The live legacy view queried a nonexistent `orders` table, so its output was broken. |
| QR & Tools | `/tools` | Missing | The target route is an architecture-readiness page, not feature parity. Missing public-menu QR generation/download/print, inventory/discount exports, previews, and stock-alert configuration/results. |
| Settings | `/settings` | Partial | Establishment name, receipt footer, low-stock threshold, cash policy, and accepted methods persist through the repository. Missing KRA/eTIMS configuration, discount rules, system/device details, and audit verification. Firebase settings updates bypass Functions and therefore do not append an audit event. |
| Customer menu (`public/menu.html`) | None | Missing / redesign | No public menu or order intake exists. The legacy page wrote to a nonexistent `online_orders` table and falsely confirmed receipt, so it must not be copied literally. |

Asset verification found 29 files common to both `legacy/vanilla-pos/public` and
`frontend/public`; every common file is byte-for-byte identical. `menu.html` is the
only legacy public file without a target counterpart.

## Dormant legacy modules requiring a product decision

These files were not imported by `legacy/vanilla-pos/src/main.js`, had no sidebar
entry, and had no mounted container:

- `src/ui/procurement.js`: requisitions, purchase orders, GRNs, dual control, and
  receiving. Its data shapes conflict with the live House Stock requisitions and
  several writes are incomplete.
- `src/ui/reports.js`: management summary, VAT3, eTIMS outbox, date selection, and a
  browser-side Gemini assistant. Several queries use nonexistent fields.

They should be marked **accept**, **redesign**, or **retire** in product scope. Their
mere presence in `legacy` is not evidence of previously working functionality.

## Data-model parity

| Legacy data area | Target representation | Status |
| --- | --- | --- |
| Tenants, branches, devices | Typed frontend contracts and Firestore collections | Carried as read models; administration/provisioning missing |
| Users | `staff`, server-only `staff_pin_credentials`, Auth custom claims | Safer redesign; management/provisioning missing |
| Categories, products, barcodes | Typed contracts and Firestore collections | Carried as read models; CRUD/media/eTIMS registration missing |
| Customers, suppliers | Typed contracts and Firestore collections | Carried as read models; maintenance missing |
| Sales, sale lines, payments | Canonical collections plus transactional `createSale` | Core cash-sale path carried; refunds, voids, held carts, credit, split tender, and provider initiation missing |
| Stock movements | Server writes SALE movements; rules/index exist | Partial; not loaded by the frontend and no general stock service exists |
| Current stock | Materialized `stock_balances` by branch/product/location | Safer redesign; only sale deduction is implemented |
| Fiscal records | None | Missing |
| Batches / expiries | None | Missing |
| Stock takes / lines | None | Missing |
| Requisitions / lines | None | Missing |
| Purchase orders / lines | None | Missing |
| GRNs / lines | None | Missing |
| Audit log | `audit_logs` | Partial; server-owned but incomplete event coverage and no integrity/retention mechanism |
| Shifts | Typed `shifts` collection | Read-only plus sale cash increment; lifecycle and cash movements missing |
| Tenant/local settings | `tenant_settings` | Partial, normalized replacement for scattered localStorage settings |
| Discounts | Only `discountMinor` on sale input/line snapshot | Missing rule/promotion model; backend now limits client-selected discounts to owners/managers |
| Public/online orders | None | Missing / redesign |

The target does not yet define canonical entities for payment intents, fiscal
attempts/outbox entries, cash movements, Z reports, returns/refunds, receivables,
discount approvals, or online orders in the shared frontend contract.

## Business-rule differences

### Deliberate safety improvements

- Money uses integer minor units instead of floating-point KES values.
- Product prices and tax metadata are read on the server during checkout.
- A sale requires an active tenant, branch, device, customer, staff member, and the
  same staff member's open shift on that device.
- Physical sales cannot make HOUSE stock negative; service products do not consume
  stock.
- Sale, lines, payments, movements, balances, payment intents, shift cash, counter,
  and audit event commit in one Firestore transaction.
- Non-cash payments require a server-created verified intent.
- PIN hashes stay server-side and use scrypt with timing-safe comparison and lockout.
- Unknown collections and browser writes to financial data are denied by default.

### Unresolved differences

- Legacy allowed Store Keepers to reach Till and explicitly blocked Supervisors.
  The target selling roles are owner, store manager, cashier, and bar staff.
- Legacy restricted Orders to owners, store managers, supervisors, and bar staff.
  The target currently omits Orders from its restricted-module map, so cashiers and
  store keepers can reach it as well.
- Legacy retail/wholesale customer pricing used `cost × 1.15` for wholesale. The
  target always uses the product's canonical sell price.
- Legacy fiscal statuses were `QUEUED`, `FISCALIZED`, and `TERMINAL_ERROR`; target
  statuses are `pending`, `submitted`, `failed`, and `not_required`.
- Legacy checkout selected any globally open shift (a defect). The Firebase backend
  correctly requires a staff/branch/device match, while the mock repository does
  not currently enforce staff ownership. The adapters must be aligned.
- Mock mode accepts enabled digital payments without verification, while Firebase
  correctly requires a verified intent. A demo provider adapter or explicit
  capability flag is needed so the two modes do not imply the same trust level.
- Mock settings keep `cashEnabled` and `acceptedPaymentMethods` consistent. Firebase
  merges both fields independently, and Till renders the method list without
  checking `cashEnabled`; cash can therefore appear selectable and then be rejected
  by the backend.
- Frontend `CreateSaleRequest.soldAt` is honored in mock mode but ignored by Firebase,
  where server time is authoritative. The contract should state this explicitly or
  remove the client field.
- Orders stores one payment per sale in a `Map`, so a future split-tender sale would
  display only the last payment instead of every settlement component.
- Legacy audit used a client-computed hash chain. Target audit records are immutable
  to browser clients but are not hash chained.

## Backend architecture audit

Before this audit, `backend/functions/src/sales.ts` was approximately 460 lines and
mixed callable transport, parsing, authorization, pricing, tax, payment policy,
inventory, Firestore reads/writes, idempotency replay, serialization, and logging.
`staff-auth.ts` similarly combined transport, validation, hashing, lockout state,
Firestore work, and response mapping.

The backend is now separated under `src/modules` and `src/shared`:

```text
src/
  config/runtime.ts
  lib/firebase.ts
  shared/
    firestore-values.ts
    identifiers.ts
    money.ts
    validation.ts
  modules/
    sales/
      create-sale.ts       callable/auth/error boundary
      input.ts             request parsing and limits
      domain.ts            pricing, tax, discounts, totals, tender policy
      base-context.ts      authoritative entity reads and authorization
      dependencies.ts      stock balances and payment intents
      fingerprint.ts       idempotency request binding
      records.ts           immutable record construction
      persistence.ts       transaction writes
      replay.ts            idempotent replay and conflict detection
      response.ts          public serialization
      transaction.ts       one transaction/unit-of-work coordinator
    staff-auth/
      authenticate-staff-pin.ts
      input.ts
      pin-crypto.ts
      verify-pin.ts
```

Callable names, collection names, existing deterministic document-ID formats, and
the single sale transaction boundary remain stable. Pure input/domain/crypto policy
has backend tests.

The refactor also closes these audit defects:

- duplicate/case-variant digital references can no longer fund multiple payment
  entries;
- idempotency keys are bound to a canonical request fingerprint, and conflicting
  reuse is rejected;
- replays return the stock-balance snapshot from the original sale rather than a
  later mutable balance;
- unknown product tax codes fail closed instead of becoming tax-free;
- buyer KRA PIN is format-validated;
- branch counter ownership/value is checked before increment;
- checkout discounts require an owner or store-manager role.

## Remaining backend and security gaps

1. There are no provider webhooks, payment-intent creation functions, or secrets
   configuration. Digital checkout is not production-ready.
2. There is no eTIMS client, fiscal outbox, retry policy, reconciliation, or fiscal
   receipt store. Tax-enabled sales remain `pending` indefinitely.
3. PIN verification does not issue a server-verifiable till-unlock grant.
   `createSale` can be called with a valid Firebase token without a recent PIN unlock.
4. Firestore reads are tenant-scoped but not role- or branch-scoped. A tenant user
   can query staff, customers, suppliers, sales, payments, stock, and audit records
   even when navigation hides those modules.
5. Settings authorization trusts role claims and writes directly from the browser;
   active staff state is not rechecked and no server audit entry is created.
6. Compound IDs made by joining underscore-permitted IDs can theoretically collide.
   They are persistence contracts and need a migration/dual-read plan before change.
7. No App Check enforcement, emulator integration tests, Firestore/Storage rules
   tests, concurrency tests, CI, seed/provisioning command, or migration framework
   exists.
8. Backend and frontend keep separate handwritten DTO/domain types with no shared
   runtime schema, making contract drift possible.
9. Firebase bootstrap reads every tenant record for many collections without date
   limits or pagination; this will not scale with sales/audit history.
10. A single branch invoice counter can become a high-contention transaction record.
11. Firebase document decoding uses unchecked TypeScript casts rather than runtime
    validation. Legacy snake_case records cannot be consumed without an explicit
    migration/transform, and malformed Firestore data can reach feature components.

## Legacy behavior that must not be copied

The audit found legacy behavior that was broken or unsafe even though its UI was
reachable:

- plaintext PIN storage and client-only authorization;
- fake Daraja/eTIMS success and offline M-Pesa being assumed paid;
- trusting Paystack browser callbacks without backend verification;
- selecting another user's/global open shift;
- completing sales without adequate cash or confirmed non-cash settlement;
- allowing negative stock and writing stock adjustments with the wrong `quantity`
  field instead of `qty`;
- claiming online orders were received when no order table existed;
- showing missing fiscal records as verified;
- broken Finance, M-Pesa, and QR sales queries against nonexistent tables/fields;
- browser-side AI keys and canned financial advice presented as analysis;
- destructive automatic database wipes on seed-version changes.

Parity means preserving user outcomes and required business rules, not preserving
these defects or simulators.

## Prioritized completion plan

### P0 — make Firebase mode operable

1. Add an emulator-only, idempotent Admin seed/provisioning tool for Auth users,
   custom claims, PIN hashes, tenant data, balances, settings, devices, and shifts.
2. Add the real Firebase sign-in/session bootstrap before the local PIN lock.
3. Implement shift open/close and cash-movement Functions, then bind Till only to
   the authenticated staff member's shift in both adapters.
4. Implement payment-provider initiation/webhooks and verified payment intents;
   hide or disable non-cash methods until each provider is configured.
5. Implement an eTIMS outbox/worker, retry states, fiscal records, and receipt data.

### P1 — restore core operating workflows

1. Product/category/barcode CRUD and secure media upload.
2. Stock receipt, adjustment, requisition approval/issue, and paired movements.
3. Staff/Auth/claim/PIN administration with dual control for privileged changes.
4. Order detail, receipt print, filters, exports, void/refund controls, and held carts.
5. Settings through an audited backend callable.

### P2 — compliance and management

1. Batches/FEFO/expiry and stock takes.
2. Date-bounded financial reports, COGS/margin, VAT3, and fiscal reconciliation.
3. Role- and branch-aware read APIs/rules, pagination, retention, App Check, and
   emulator/rules/concurrency tests in CI.
4. Decide whether Procurement and the public QR menu are accepted, redesigned, or
   retired; implement only after their canonical data models are approved.

## Verification performed

- Frontend ESLint, strict TypeScript check, 11 Vitest tests, and Next.js static
  production build passed. All 12 POS routes were emitted.
- Backend strict TypeScript build and 9 Node policy tests passed after the refactor.
- The archived Vite app builds successfully after installing its locked dependencies.
  Vite reports that a dynamic `db/index.js` import is also statically imported, so it
  cannot be split into another chunk; this is a performance warning, not a failure.
- Full `npm audit` reports zero findings for the target frontend and backend.
- The archived legacy app has no production-dependency finding with dev dependencies
  omitted, but its old Vite/esbuild development toolchain reports two findings (one
  moderate and one high). It should remain archived rather than be deployed.
- Firebase predeploy now runs the backend policy test suite. No emulator, rules,
  callable, provider, fiscal, concurrency, or end-to-end tests exist yet; the passing
  builds do not establish production parity.

## Exit criteria for a future “parity complete” claim

- Every live legacy row in the screen table is either **Carried** or has a signed
  product decision accepting a redesign/retirement.
- Every target mutation has a trusted Firebase path, authorization checks, an audit
  event, idempotency where applicable, and emulator tests.
- Cash, each enabled digital method, fiscalization, shift close, stock transfer,
  refund/void, and degraded-network recovery pass end-to-end tests.
- Mock and Firebase adapters enforce the same domain rules and response shapes.
- No required production record must be created manually in the Firebase console.
- Role/branch data access is verified by rules tests, not only hidden navigation.
- Reports and receipts reconcile exactly to canonical sales, payments, movements,
  shifts, and fiscal records.
