# ADR-0004: Store new images in private Azure Blob Storage

## Context

Profiles/messages historically stored external or Cloudinary URLs. Migration 010, `AZURE_BLOB_STORAGE.md`, upload routes, and the Azure service now track blob names/provider and generate read URLs.

## Decision

Store every new uploaded image in a private Azure Blob container. Persist a stable blob name and provider marker, generate short-lived read-only SAS URLs for display, use Managed Identity in Azure production, and retain read compatibility for legacy external/Cloudinary URLs.

## Rationale

The storage guide explicitly establishes private access, keyless production identity, stable database references, metadata stripping, and staged legacy migration.

## Alternatives

Cloudinary/external URLs remain supported for existing rows. A public container or permanent signed URL is explicitly rejected by the implementation. Historical provider comparison beyond the checked-in guide is unknown.

## Consequences

- The runtime identity needs Blob Data Contributor and Blob Delegator permissions.
- URLs are ephemeral; callers must store blob names, not SAS URLs.
- Local development needs a connection string or usable developer identity.
- Legacy assets require a separately verified migration before source deletion.

## Status

Accepted.
