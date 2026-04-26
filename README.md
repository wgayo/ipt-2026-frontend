# Angular 21 Auth Boilerplate (Beginner Guide)

This project is a beginner-friendly Angular 21 boilerplate that demonstrates a complete authentication flow:

- Email sign up + email verification
- Login + logout
- JWT auth header for API requests
- Refresh tokens (cookie-based) + auto-refresh before access token expiry
- Forgot password + reset password
- Role-based authorization (User & Admin)
- Admin area for account management
- Profile area for viewing/updating your own account

## Table of contents

- [1) Prerequisites](#1-prerequisites)
- [2) Run the app (real API)](#2-run-the-app-real-api)
- [3) Run the app (fake backend, no API)](#3-run-the-app-fake-backend-no-api)
- [4) Using the app (what to click)](#4-using-the-app-what-to-click)
- [5) How authentication works](#5-how-authentication-works)
- [6) Authorization (roles + route guards)](#6-authorization-roles--route-guards)
- [7) Project structure (quick tour)](#7-project-structure-quick-tour)
- [8) Troubleshooting](#8-troubleshooting)

## 1) Prerequisites

- Node.js (LTS recommended)
- npm (comes with Node.js)
- (Optional) Angular CLI:
  - `npm i -g @angular/cli`

## 2) Run the app (real API)

By default this project is set up to call a real API at:

- `http://localhost:4000` (see `src/environments/environment.ts`)

### Step 1: install packages

From the project root (where `package.json` is):

```bash
npm install
```

### Step 2: start your backend API

Start an API that implements the `/accounts/*` endpoints described in the [How authentication works](#5-how-authentication-works) section.

The frontend expects the API to be available at `http://localhost:4000` by default.

### Step 3: start Angular

```bash
npm start
```

This runs `ng serve --open` and should open the app in your browser.

### Step 4: update API URL (if your API runs elsewhere)

Edit the environment file:

- `src/environments/environment.ts` (development)
- `src/environments/environment.prod.ts` (production build)

Update:

```ts
apiUrl: 'http://localhost:4000'
```

## 3) Run the app (fake backend, no API)

If you want to run everything fully in the browser (no backend), you can enable the built-in fake backend interceptor.

### Step 1: enable the fake backend provider

Open `src/app/app.module.ts` and uncomment the `fakeBackendProvider` line in the `providers` array.

It should look like this:

```ts
    providers: [
        { provide: APP_INITIALIZER, useFactory: appInitializer, multi: true, deps: [AccountService] },
        { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },

        // provider used to create fake backend
        fakeBackendProvider
    ],
```

### Step 2: run the app

```bash
npm install
npm start
```

### How the fake backend behaves (important for beginners)

- Accounts are stored in your browser `localStorage`, not in a database.
- “Emails” (verification + reset password links) are displayed in the UI as alerts because a browser-only app can’t send real emails.
- The first registered account becomes `Admin`, and all other accounts become `User`.

If you want a clean slate while using the fake backend, clear site data in your browser or remove the local storage key:

- `angular-15-signup-verification-boilerplate-accounts`

## 4) Using the app (what to click)

This section assumes you are starting fresh and want to see the full flow.

### A) Create an account

1. Go to Register
2. Fill in your details and submit
3. If you are using the fake backend, a “verification email” will appear as an alert with a link
4. Click the verification link (or paste it in the browser) to verify your account

### B) Login

1. Go to Login
2. Enter your email + password
3. On success you’ll be redirected to the home page

### C) Forgot password + reset password

1. Go to Forgot Password
2. Enter your email and submit
3. If you are using the fake backend, a “reset password email” will appear as an alert with a link
4. Click the reset link and set a new password

### D) Profile and Admin areas

- Profile pages allow you to view and update your own account details.
- The Admin area is restricted to accounts with the `Admin` role.

## 5) How authentication works

This boilerplate uses two tokens:

- Access token (JWT): short-lived token used in the `Authorization: Bearer <token>` header
- Refresh token: long-lived token stored in a cookie and sent with `withCredentials: true`

### The important pieces

- API base URL:
  - `src/environments/environment.ts`
- Account service (login/logout/refresh/register/etc.):
  - `src/app/_services/account.service.ts`
- App initializer (tries to refresh on first app load):
  - `src/app/_helpers/app.initializer.ts`
- JWT interceptor (adds the `Authorization` header for API calls):
  - `src/app/_helpers/jwt.interceptor.ts`
- Error interceptor (auto-logout on 401/403):
  - `src/app/_helpers/error.interceptor.ts`

### Flow: login

1. Login component calls `AccountService.login(email, password)`
2. The API returns an `Account` object that includes `jwtToken`
3. The app stores the account in memory (a `BehaviorSubject`) and starts a refresh timer
4. For future API requests, the JWT interceptor attaches `Authorization: Bearer ...`

### Flow: refresh token (important)

1. The refresh token is sent to the API using cookies (`withCredentials: true`)
2. The API responds with a new access token (`jwtToken`)
3. The app schedules an automatic refresh about 1 minute before the access token expires
4. When you reload the page, `APP_INITIALIZER` calls refresh immediately to restore the session (if the cookie is still valid)

### Expected API endpoints

The frontend calls these endpoints (base URL is `environment.apiUrl`):

- `POST /accounts/authenticate`
- `POST /accounts/refresh-token`
- `POST /accounts/revoke-token`
- `POST /accounts/register`
- `POST /accounts/verify-email`
- `POST /accounts/forgot-password`
- `POST /accounts/validate-reset-token`
- `POST /accounts/reset-password`
- `GET /accounts` (Admin)
- `GET /accounts/:id`
- `POST /accounts` (Admin)
- `PUT /accounts/:id`
- `DELETE /accounts/:id`

## 6) Authorization (roles + route guards)

Routes are protected with `AuthGuard`:

- If you are not logged in, you are redirected to `/account/login`
- If you are logged in but don’t have the required role, you are redirected to `/`

Role restrictions are applied using route data, for example:

- `/admin` requires `Role.Admin`

Key files:

- `src/app/_helpers/auth.guard.ts`
- `src/app/_models/role.ts`
- `src/app/app-routing.module.ts`

## 7) Project structure (quick tour)

Most code lives under `src/app`:

- `_services/` shared services (e.g. `AccountService`, `AlertService`)
- `_helpers/` cross-cutting helpers (guards, interceptors, app initializer, fake backend)
- `_models/` shared types and enums (Account, Role, Alert)
- `account/` auth screens (login/register/verify/forgot/reset)
- `profile/` user profile screens
- `admin/` admin-only screens for account management

The UI is styled with Bootstrap 5 via a CDN link in:

- `src/index.html`

## 8) Troubleshooting

### The app redirects me back to login after refresh

- If you are using a real API, make sure it sets a refresh token cookie and supports `POST /accounts/refresh-token`.
- If your API runs on a different origin (different hostname/port), you must configure CORS to allow credentials and ensure cookies are set with the correct `SameSite`/`Secure` settings.

### I’m calling an API on another port and cookies aren’t being sent

This frontend uses `withCredentials: true` for login/refresh/revoke, but the backend must also:

- Enable CORS with credentials
- Return `Access-Control-Allow-Credentials: true`
- Allow the frontend origin in `Access-Control-Allow-Origin` (it cannot be `*` when using credentials)

### I want to reset the fake backend data

- Clear browser storage for the site, or remove the local storage key:
  - `angular-15-signup-verification-boilerplate-accounts`

### Run unit tests

```bash
npm test
```
