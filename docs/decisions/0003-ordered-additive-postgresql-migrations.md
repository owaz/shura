# ADR-0003: Evolve the legacy PostgreSQL schema with ordered additive migrations

## Context

Shura began with checked-in base/one-off SQL schemas and accumulated compatibility differences. Current migrations are deliberately additive, ordered by filename, transactional, and recorded in `schema_migrations`. Several migrations contain data repair for legacy installations.

## Decision

Use `production_schema.sql` only to bootstrap legacy-compatible base tables on a fresh database, then apply immutable numbered migrations through `scripts/migrate.js`. New schema changes must be new additive migrations; compatibility and data repair belong in migrations rather than manual production SQL.

## Rationale

Migration comments and implementation emphasize safe upgrades across existing installations while retaining current route compatibility. No fuller historical database-tool evaluation is recorded.

## Alternatives

Legacy `setup.sql`, `intake_schema.sql`, `local_compat_schema.sql`, one-off scripts, and runtime startup DDL exist. An ORM migration framework is not present.

## Consequences

- Fresh setup currently has a two-step bootstrap plus migration process.
- Already-applied files cannot be edited safely.
- Fresh migration verification must use an isolated disposable database. Some immutable legacy migrations contain unqualified metadata checks, so a temporary schema inside a populated database is not an equivalent clean-bootstrap boundary.
- The migration-test role requires `CREATEDB` only in isolated development/CI; the application runtime role does not.
- Compatibility columns and runtime DDL remain technical debt.
- Deployment must orchestrate migrations separately; the current Azure workflow does not.

## Status

Accepted (inferred from current tooling and migration comments). The reason no ORM or single self-contained baseline was selected is unknown.
