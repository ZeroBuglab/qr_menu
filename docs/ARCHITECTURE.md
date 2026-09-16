# Architecture decisions

## Order state machine

```text
NEW ──► COOKING ──► READY ──► DELIVERING ──► COMPLETED
 │          │          │            │
 └──────────┴──────────┴────────────┴──────► CANCELLED
```

The API is authoritative. Every state change is validated, written together with `OrderStatusHistory`, recorded in `AuditLog` for staff changes, and broadcast after the database transaction. UI clients treat Socket.IO messages as a refresh signal, not as permission to invent state.

## Data isolation

All restaurant-owned entities carry a `restaurantId` directly or through an explicitly constrained relation. Staff access is resolved from the session's `Employee` membership. Mutating handlers compare the resource restaurant with the membership restaurant before performing the write. Public order creation recomputes prices from database rows and rejects unavailable or cross-restaurant products.

## Boundaries for future work

- `Payment` plus a provider adapter can support Kaspi or another gateway without leaking provider details into order logic.
- `Restaurant` is the tenant boundary; branches can be added by introducing a parent account/branch relation.
- Notifications should consume domain events rather than being embedded in HTTP handlers.
- Uploads should use an object storage adapter with MIME sniffing, size limits, and malware scanning.
