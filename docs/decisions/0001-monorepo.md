# ADR-0001: Modular Monorepo

## Status

Accepted

## Context

The project contains a backend API, frontend application, shared UI components, shared database package, and shared configurations.

## Decision

Use a Turborepo monorepo with:

- apps/
- packages/
- docs/
- docker/

Applications depend on packages.

Packages never depend on applications.

## Consequences

- Shared code lives in packages.
- Independent deployment remains possible.
- Easy future extraction into microservices if needed.
