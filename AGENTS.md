# AGENTS.md

## Cursor Cloud specific instructions

### Repository state (important)

This repository is currently **spec-only**. The only tracked files are:

- `requirements.md` — the product specification (a Pakistan retail POS system with FBR/PRAL tax integration).
- `.gitignore`

There is **no application code, no dependency manifest, no lockfile, and no build/run tooling** yet
(no `package.json`, `composer.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, `Dockerfile`,
`docker-compose.yml`, etc.), and the `main` and `write-spec` branches are identical. As a result there is
**nothing to install, build, run, lint, or test** in the current state — the environment "setup" is a no-op
until a stack is chosen and the project is scaffolded.

### What to do once code exists

The stack is intentionally undecided in `requirements.md` ("Technical Considerations"). Recommended options:

- Client: Next.js (web POS) or Electron (desktop POS)
- Backend: Node.js or Laravel (PHP)
- Primary DB: PostgreSQL or MySQL
- Local offline cache: SQLite or IndexedDB
- Server-side FBR/PRAL adapter for credentials, payload signing/transformation, retries, and response persistence

When the project is scaffolded, revisit environment setup:

1. Update the Cursor Cloud **update script** to install dependencies for the chosen package manager
   (e.g. `npm install` / `pnpm install` / `composer install` / `pip install -r requirements.txt`).
   Match the package manager to the committed lockfile.
2. Add the real dev/lint/test/build commands and any required services (DB, background sync worker,
   FBR sandbox connection) here, or reference them from the project's README / `package.json` scripts / Makefile
   rather than duplicating.

### Available tooling in this environment

- Node.js `v22.14.0`, npm `10.9.7`
- Python `3.12.3`
- (Docker and PHP are not preinstalled.)
