# Development Tasks - TASK_2026_175

## Batch 1: Auth Service, Guard, Login Component, Route Updates - COMPLETE

**Developer**: nitro-frontend-developer

### Task 1.1: Create AuthService

**File**: apps/dashboard/src/app/services/auth.service.ts
**Status**: COMPLETE

Signal-based auth service. Reads API key from localStorage on init, exposes `isAuthenticated` computed signal, `setApiKey()`, `clearApiKey()`, and `verifyApiKey()` Observable (calls `/api/v1/health` with X-Api-Key header).

### Task 1.2: Create authGuard

**File**: apps/dashboard/src/app/guards/auth.guard.ts
**Status**: COMPLETE

Functional Angular route guard (`CanActivateFn`). Checks `AuthService.isAuthenticated()` — redirects to `/login` if false, passes through if true.

### Task 1.3: Create LoginComponent

**File**: apps/dashboard/src/app/views/login/login.component.ts
**File**: apps/dashboard/src/app/views/login/login.component.html
**File**: apps/dashboard/src/app/views/login/login.component.scss
**Status**: COMPLETE

Standalone component with NG-Zorro card layout. API key input (password type), Connect button with loading state, error alert on invalid key. Calls `verifyApiKey()` before storing.

### Task 1.4: Update app.routes.ts

**File**: apps/dashboard/src/app/app.routes.ts
**Status**: COMPLETE

Added `canActivate: [authGuard]` to the root layout route. Added `/login` as a top-level route. Added `{ path: '**', redirectTo: 'dashboard' }` inside layout children.
