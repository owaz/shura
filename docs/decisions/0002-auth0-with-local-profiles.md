# ADR-0002: Use Auth0 for authentication with local role-specific profiles

## Context

Shura needs login, email verification, social-connection policy, role/status enforcement, admin MFA, and account lifecycle while retaining relational application data. The repository contains an Auth0 migration guide, frontend Auth0 SDK integration, backend JWKS validation, tenant Actions, and local `auth0_sub` columns.

## Decision

Use Auth0 Universal Login and audience-bound RS256 access tokens for authentication. Map each Auth0 subject to exactly one role-specific local table (`users`, `therapists`, or `admins`) for domain/profile data. Synchronize administrative lifecycle changes to Auth0 metadata/blocking where a linked subject exists.

## Rationale

The repository explicitly records migration away from custom JWT/password login and implements centralized identity controls in Auth0 while keeping application-specific relational data in PostgreSQL.

## Alternatives

Legacy Argon2/bcrypt password, refresh-cookie, and local JWT code remains but active login endpoints return HTTP 410. A fully Auth0-only profile store was not chosen. Other identity providers are not documented.

## Consequences

- Auth0 tenant Actions/configuration are part of the application deployment.
- Authorization still belongs in the backend; Auth0 claims alone do not prove resource ownership.
- Local and Auth0 state can diverge and needs careful failure handling/reconciliation.
- Browser storage of access tokens increases the importance of XSS prevention.

## Status

Accepted. Migration intent is documented; detailed historical provider evaluation is unknown.
