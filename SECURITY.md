# Security review and controls

This project is designed to make the server the security boundary.

## Implemented controls

- Passwords are hashed with Argon2id; plaintext passwords are never persisted.
- Staff sessions use random opaque tokens stored as SHA-256 hashes and sent in an HttpOnly, SameSite cookie. Production cookies are Secure.
- Staff route mutations require a valid session, an allowed role, and a matching tenant membership. Public URLs are not treated as authorization.
- Zod validates path and JSON inputs. Prisma parameterizes database access; no user input is concatenated into SQL.
- Order totals, item availability, and product prices are recomputed on the server.
- Helmet, CORS allowlisting, body-size limits, rate limiting, and generic production error responses are enabled.
- Status changes are transactional, auditable, and broadcast only after persistence.
- Public order WebSocket subscriptions require a high-entropy per-order tracking token; restaurant staff rooms are not exposed to unauthenticated sockets.
- Docker images run as a non-root `app` user. The application has no shell execution feature and no SSH dependency.
- Secrets come from environment variables. `.env` is ignored by git.

## Required production hardening

- Terminate TLS at the edge, set `WEB_ORIGIN` to the exact HTTPS origin, and use a managed secret store.
- Add CSRF protection for cookie-authenticated state-changing browser requests if the deployment uses cross-site embedding or relaxes SameSite.
- Add a short-lived session rotation/revocation job and account lockout/backoff for repeated failed logins.
- Put PostgreSQL on a private network with a least-privilege application role and encrypted backups.
- Add an object-storage upload adapter before enabling restaurant image uploads; reject SVG/script content and scan files.
- Restrict Socket.IO room subscription to authenticated staff or a high-entropy order access token; public order tracking should use a scoped, non-guessable token rather than a raw database ID.
- Add dependency, container, secret, and SAST scans to CI.

## Security test matrix

The release gate should include authentication, RBAC, tenant isolation, IDOR, CSRF, XSS output encoding, SQL injection, rate limiting, WebSocket room authorization, file upload validation, secret leakage, and Docker non-root checks. Test both positive and negative cases for every staff role.
