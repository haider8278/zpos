# ZPOS - FBR-Integrated Point of Sale System

A secure, offline-capable Point of Sale system for the Pakistani market with real-time FBR (PRAL) fiscal invoice integration.

## Architecture

- **Client**: Electron desktop app with Next.js renderer
- **Server**: Node.js (Fastify) with PostgreSQL
- **Offline Store**: Encrypted SQLite
- **Monorepo**: pnpm workspaces with Turbo

## Project Structure

```
zpos/
├── apps/
│   ├── server/          # Node.js API server
│   └── desktop/         # Electron + Next.js POS app
├── packages/
│   └── shared/          # Shared types, schemas, and business logic
└── .github/
    └── workflows/       # CI/CD configuration
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 14

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp apps/server/.env.example apps/server/.env
   ```

4. Update the `.env` file with your configuration

5. Run database migrations:
   ```bash
   cd apps/server
   pnpm db:generate
   pnpm db:migrate
   ```

### Development

Start all packages in development mode:
```bash
pnpm dev
```

Or run individual packages:
```bash
# Server only
cd apps/server
pnpm dev

# Desktop app only
cd apps/desktop
pnpm dev
```

### Building

Build all packages:
```bash
pnpm build
```

### Testing

Run tests:
```bash
pnpm test
```

### Linting

```bash
pnpm lint
```

## Phase 1 - Foundation, Auth and RBAC

This phase includes:

✅ **Monorepo Structure**
- pnpm workspace with server, desktop, and shared packages
- Turbo for build orchestration
- TypeScript configuration

✅ **Configuration**
- Environment-based config for FBR sandbox/production
- Separate profiles for different environments
- Never hardcoded credentials

✅ **Database Schema**
- PostgreSQL with Drizzle ORM
- Tables: users, roles, permissions, stores, terminals, audit_logs
- Refresh tokens for auth

✅ **Authentication**
- Argon2id password hashing
- JWT access tokens (15m expiry)
- Rotating refresh tokens (7d expiry)
- Terminal registration

✅ **RBAC (Role-Based Access Control)**
- Three roles: Admin, Store Manager, Cashier
- Permission-based authorization
- Middleware for permission checks

✅ **Audit Logging**
- Append-only audit logs
- Tracks: user, action, terminal, before/after values
- All privileged actions logged

✅ **CI/CD**
- GitHub Actions workflow
- Lint, type-check, build, and test
- PostgreSQL service for tests

## FBR Integration

The system supports both FBR sandbox and production environments. Configure via environment variables:

- `FBR_ENVIRONMENT`: `sandbox` or `production`
- `FBR_SANDBOX_ENDPOINT`: FBR sandbox API endpoint
- `FBR_SANDBOX_TOKEN`: Bearer token for sandbox
- `FBR_SANDBOX_POSID`: POS ID for sandbox
- `FBR_PROD_ENDPOINT`: FBR production API endpoint
- `FBR_PROD_TOKEN`: Bearer token for production
- `FBR_PROD_POSID`: POS ID for production

## Security

- Passwords hashed with Argon2id
- JWT for stateless authentication
- Rotating refresh tokens
- Role-based access control
- Audit logging for all privileged actions
- Rate limiting
- Helmet security headers

## License

Proprietary
