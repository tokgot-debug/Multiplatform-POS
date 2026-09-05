# Multiplatform POS

Multiplatform POS is now structured as a tenant-aware Next.js and Firebase platform. The active frontend is an independent Next.js App Router project; privileged financial mutations run in Firebase Cloud Functions.

> **Migration status:** this is a partial-parity foundation, not yet a production
> replacement for every legacy workflow. See the
> [legacy-to-Next migration audit](docs/legacy-parity-audit.md) for the verified
> feature matrix, known blockers, and prioritized completion plan.

## Repository layout

```text
.
|-- frontend/              Next.js 16 frontend (static export to frontend/out)
|   |-- public/            Product and brand assets
|   `-- src/
|       |-- app/           App Router entry, providers, and global styles
|       |-- components/    Reusable shell and UI components
|       |-- features/      POS feature screens
|       |-- lib/           Mock seed, repositories, and Firebase client
|       `-- types/         Canonical POS domain contracts
|-- backend/functions/     Trusted Firebase Functions (TypeScript)
|-- scripts/               Emulator startup, readiness, and seed tooling
|-- docs/                  Migration and architecture audits
|-- legacy/vanilla-pos/    Recoverable parity reference; not built or deployed
|-- firebase.json          Hosting, emulators, Functions, Firestore, and Storage
|-- firestore.rules        Tenant authorization boundary
|-- firestore.indexes.json
|-- storage.rules
`-- .firebaserc.example    Project-alias template; no real project ID
```

The unrelated `Psychological  Global Counseling/` prototype is not part of the POS
application or this migration audit.

## Frontend data boundary

Feature components never import fixture arrays or Firestore directly. They consume one typed `PosRepository` contract:

- `MockPosRepository` is the current development implementation.
- `FirebasePosRepository` reads tenant-scoped Firestore collections and sends privileged writes to callable Functions.
- `NEXT_PUBLIC_DATA_SOURCE=mock|firebase` selects the adapter.

All temporary fixture records live in `frontend/src/lib/mock-data.ts`. Money is stored as integer minor units, all quantities use `qty`, timestamps cross the repository boundary as ISO strings, and `sales` is the only canonical sale/order collection.

The mock fixture is presentation/development data—not a browser-side Firestore seed and never a fallback when Firebase mode is selected. Mock staff PINs also live only in that file. The default cashier profile uses PIN `1111` for local smoke testing.

## Local development

Prerequisites:

- Node.js 22
- Firebase CLI
- JDK 21 or newer for the Firestore and Storage emulators
- A Firebase project for deployment, or a `demo-*` project name for emulator-only work

Install and start the frontend:

```bash
cd frontend
npm install
copy .env.example .env.local   # Windows; use cp on macOS/Linux
npm run dev
```

The checked-in environment example starts in mock mode and contains no Firebase values.

Install and build Functions independently:

```bash
cd backend/functions
npm install
npm run build
```

On Windows, the checked-in setup script can persist JDK 21 as the machine-wide
Java runtime. Run it once from an elevated PowerShell; it validates Java before
updating the machine-level `JAVA_HOME` and `Path` values:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/set-java21-machine.ps1
```

Start the local Firebase suite from the repository root:

```bash
npm run emulators
```

The wrapper selects an installed JDK 21 or newer, starts the canonical
`demo-tokgut-pos` emulator project, waits for every configured service to register
with the Emulator Hub, and then runs the emulator-only seed. The seed generates
the local sign-in password and till PIN at runtime and prints them after successful
provisioning; no credentials are stored in source, public environment files, or
Firestore. The generated values are also written to the ignored local file
`.emulator/generated-credentials.json`. Configured services are Auth, Functions,
Firestore, Storage, Hosting, and the Emulator UI. Press Ctrl+C in that terminal to
stop the complete suite.

Run `npm run emulators:doctor` to validate Java, the Firebase CLI, configuration,
and the seed entry point without starting a process. If multiple JDKs are installed,
set `POS_JAVA_HOME` for this command to select one without changing machine-wide
configuration.

## Firebase mode

Set these values in `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_DATA_SOURCE=firebase
NEXT_PUBLIC_TENANT_ID=your-tenant-document-id
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Firebase mode fails immediately when required configuration is absent; it never guesses a project or silently loads mock records.

Firebase mode shows an email/password account sign-in before it requests any
tenant data. Once Firebase Authentication succeeds, the adapter validates these
trusted Admin-assigned ID-token claims before showing the secondary POS PIN lock:

```text
tenant_id   exact tenant document ID
staff_id    exact staff document ID
staff_role  owner | store_manager | supervisor | store_keeper | cashier | bar_staff
```

The local four-digit PIN is a secondary till lock, not an authentication or authorization boundary. `authenticateStaffPin` requires the Firebase identity and claims above, verifies a server-only scrypt hash, records audit activity, and locks the profile for 15 minutes after five failures. Credential documents are never browser-readable:

```text
staff_pin_credentials/{tenantId}_{staffId}
  tenantId, staffId, pinSaltBase64, pinHashBase64
```

The emulator seed generates `pinSaltBase64` from 16 random bytes and
`pinHashBase64` with Node `crypto.scrypt(pin, salt, 32)`. Plaintext passwords and
PINs are never embedded in application source or written to Firestore.

## Trusted sale creation

`createSale` accepts the same request used by the frontend repository:

```ts
{
  tenantId: string;
  branchId: string;
  deviceId: string;
  shiftId: string;
  staffId: string;
  customerId: string;
  idempotencyKey: string;
  tableNumber?: string;
  buyerKraPin?: string;
  lines: Array<{
    productId: string;
    qty: number;
    discountMinor?: number;
  }>;
  payments: Array<{
    method: "cash" | "mpesa" | "card" | "airtel_money" | "bank_transfer";
    amountMinor: number;
    reference?: string;
  }>;
}
```

The function ignores client pricing. Inside one Firestore transaction it validates the tenant, branch, device, staff, open shift, customer, enabled payment methods, authoritative product prices, discounts, and HOUSE stock; then writes the sale, line snapshots, payments, stock movements, balance changes, shift cash, invoice counter, and audit event. A deterministic sale document makes retries idempotent and returns the full existing result on replay.

Cash is trusted directly. Non-cash entries require a server-created, unconsumed `payment_intents` document with matching tenant, method, amount, verified status, and provider reference. Provider webhook Functions will create those intents later; the browser cannot mark a digital payment verified.

Canonical Firestore fields are camelCase and match `frontend/src/types/pos.ts`. Tenant-owned documents contain `tenantId`; balance documents use `${branchId}_${productId}_HOUSE` IDs with `location: "HOUSE"` and `qty`.

## Firestore and Storage security

- Tenant reads require an exact `tenant_id` custom claim and a matching document `tenantId`.
- Sales, lines, payments, stock, shifts, audit records, counters, payment intents, and PIN material cannot be written directly by clients.
- Tenant settings are the only current direct client mutation and are limited to owner/store-manager claims plus an explicit field allow-list.
- Unknown Firestore collections and Storage paths are denied by default.

Hiding navigation items is only a user-experience feature; security rules and Functions remain authoritative.

## Build, verify, and deploy

```bash
cd frontend
npm run lint
npm run typecheck
npm run test:run
npm run build

cd ../backend/functions
npm run build

cd ../..
firebase deploy
```

Classic Firebase Hosting serves `frontend/out` with no SPA catch-all because Next static export emits its own route files. If the frontend later requires SSR, Server Actions, or dynamic server rendering, move it to Firebase App Hosting or Cloud Run rather than adding an `index.html` rewrite.

For a real project, copy `.firebaserc.example` to `.firebaserc` and replace the placeholder. `.firebaserc`, service-account JSON, private environment files, emulator logs, and build output are intentionally ignored.

## Emulator seed safety

`scripts/seed-emulators.cjs` is an Admin SDK seed for local testing only. It
hard-fails unless both Auth and Firestore hosts are loopback addresses and every
configured project identifier exactly equals `demo-tokgut-pos`. Only after those
guards pass does it clear the ephemeral emulator state, create the Auth account
and claims, hash the generated PIN, and write relationally consistent test data.
It cannot be used as a production seed.
