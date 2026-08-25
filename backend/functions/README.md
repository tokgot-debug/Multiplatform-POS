# Firebase Functions backend

This project contains trusted POS mutations. The frontend may read tenant-scoped
projections, but it must not reproduce financial or credential logic in browser
components.

## Module boundaries

- `src/modules/sales`: the `createSale` callable and its complete transactional
  unit of work.
- `src/modules/staff-auth`: PIN parsing, scrypt verification, lockout state, and the
  `authenticateStaffPin` callable.
- `src/shared`: small cross-module validation, money, identifier, and Firestore
  serialization helpers.
- `src/lib/firebase.ts`: the single Admin SDK connection.
- `src/index.ts`: Firebase discovery exports only.

The sale flow intentionally has one transaction coordinator. Context and dependency
modules perform reads; record and persistence modules build and write the result;
no extracted service starts a nested transaction.

## Invariants

- Keep public callable names and request/response shapes compatible with the
  frontend repository contract.
- Treat collection names and deterministic document IDs as persistence contracts.
  Changing one requires a migration or dual-read compatibility period.
- Use server product prices and integer minor units.
- Perform every sale-related read before any transaction write.
- Never accept browser assertions that a provider payment or fiscal submission
  succeeded.
- Never return PIN hashes, salts, attempt documents, request fingerprints, or other
  internal transaction metadata.

## Verification

```bash
npm test
```

The build first removes the generated `lib` directory so deleted or renamed source
modules cannot survive as stale deployment artifacts. The test command then compiles
strict TypeScript and runs the pure sales/PIN policy tests.
Emulator, callable, security-rules, and concurrency coverage is still required; see
`../../docs/legacy-parity-audit.md`.
