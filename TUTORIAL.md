# Building an Angular 21 Auth Boilerplate (Beginner Tutorial)

This tutorial walks you through building an Angular 21 authentication boilerplate similar to the one in this repository. You’ll build it step-by-step so you understand how routing, guards, forms, interceptors, and token refresh fit together.

What you will build:

- Email sign up + email verification
- Login + logout
- Forgot password + reset password
- JWT auth header for API requests
- Refresh token flow (cookie-based) + automatic token refresh
- Role-based access control (User/Admin)
- Admin area (manage accounts) + Profile area (manage your account)
- Optional fake backend (runs fully in the browser for learning)

---

## Part 0: Prerequisites

- Node.js (LTS recommended)
- npm (comes with Node.js)
- Angular CLI (recommended for beginners):

```bash
npm i -g @angular/cli
```

---

## Part 1: Create a new Angular 21 project

Create a new project with routing enabled. This repo uses Less, so choose Less when prompted.

```bash
ng new angular-21-boilerplate --routing --style=less
cd angular-21-boilerplate
```

Run it once to confirm everything works:

```bash
npm start
```

---

## Part 2: Add Bootstrap styling (simple way)

For a beginner-friendly setup, load Bootstrap from a CDN in `src/index.html`:

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
```

You can also keep your own styles in `src/styles.less`.

---

## Part 3: Plan the screens and routes

You’ll build these sections:

- `/account/*` (public): login, register, verify email, forgot password, reset password
- `/` (private): home screen, requires login
- `/profile/*` (private): view/update your own account
- `/admin/*` (private + Admin role): manage accounts

Angular routes will be protected using an auth guard, and the admin section will also check user roles.

---

## Part 4: Create shared models

Create `src/app/_models` and add:

### 1) Role enum (`_models/role.ts`)

```ts
export enum Role {
    Admin = 'Admin',
    User = 'User'
}
```

### 2) Account model (`_models/account.ts`)

This is the shape the frontend expects after login/refresh.

```ts
import { Role } from './role';

export class Account {
    id?: string;
    title?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: Role;
    dateCreated?: string;
    isVerified?: boolean;
    jwtToken?: string;
}
```

---

## Part 5: Configure an API base URL

Create an environment file (Angular CLI already generates it). Add the API URL:

`src/environments/environment.ts`

```ts
export const environment = {
    production: false,
    apiUrl: 'http://localhost:4000'
};
```

You can later connect this to a real backend (for example, a Node.js + MySQL API).

---

## Part 6: Build the AccountService (auth + tokens)

Create `src/app/_services/account.service.ts`.

Conceptually, this service does three big jobs:

1. Stores the current logged-in account (in-memory) so components can react to login/logout
2. Calls the backend for authentication actions (login/register/verify/etc.)
3. Runs an auto-refresh timer that refreshes the JWT shortly before it expires

Key idea:

- Access token (JWT) is returned in JSON (`jwtToken`)
- Refresh token is stored in a cookie (backend sets it)
- Requests that rely on the cookie must use `withCredentials: true`

Minimal structure:

```ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, finalize } from 'rxjs/operators';

import { environment } from '@environments/environment';
import { Account } from '@app/_models';

const baseUrl = `${environment.apiUrl}/accounts`;

@Injectable({ providedIn: 'root' })
export class AccountService {
    private accountSubject: BehaviorSubject<Account | null>;
    public account: Observable<Account | null>;
    private refreshTokenTimeout?: any;

    constructor(private router: Router, private http: HttpClient) {
        this.accountSubject = new BehaviorSubject<Account | null>(null);
        this.account = this.accountSubject.asObservable();
    }

    public get accountValue() {
        return this.accountSubject.value;
    }

    login(email: string, password: string) {
        return this.http.post<any>(`${baseUrl}/authenticate`, { email, password }, { withCredentials: true })
            .pipe(map(account => {
                this.accountSubject.next(account);
                this.startRefreshTokenTimer();
                return account;
            }));
    }

    logout() {
        this.http.post(`${baseUrl}/revoke-token`, {}, { withCredentials: true }).subscribe();
        this.stopRefreshTokenTimer();
        this.accountSubject.next(null);
        this.router.navigate(['/account/login']);
    }

    refreshToken() {
        return this.http.post<any>(`${baseUrl}/refresh-token`, {}, { withCredentials: true })
            .pipe(map(account => {
                this.accountSubject.next(account);
                this.startRefreshTokenTimer();
                return account;
            }));
    }

    private startRefreshTokenTimer() {
        const jwtBase64 = this.accountValue!.jwtToken!.split('.')[1];
        const jwtToken = JSON.parse(atob(jwtBase64));
        const expires = new Date(jwtToken.exp * 1000);
        const timeout = expires.getTime() - Date.now() - (60 * 1000);
        this.refreshTokenTimeout = setTimeout(() => this.refreshToken().subscribe(), timeout);
    }

    private stopRefreshTokenTimer() {
        clearTimeout(this.refreshTokenTimeout);
    }
}
```

---

## Part 7: Add interceptors (JWT header + error handling)

Interceptors let you hook into every HTTP request/response.

### 1) JWT interceptor

This adds `Authorization: Bearer <jwt>` to API requests.

`src/app/_helpers/jwt.interceptor.ts`

```ts
import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '@environments/environment';
import { AccountService } from '@app/_services';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
    constructor(private accountService: AccountService) {}

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const account = this.accountService.accountValue;
        const isLoggedIn = account && account.jwtToken;
        const isApiUrl = request.url.startsWith(environment.apiUrl);

        if (isLoggedIn && isApiUrl) {
            request = request.clone({
                setHeaders: { Authorization: `Bearer ${account.jwtToken}` }
            });
        }

        return next.handle(request);
    }
}
```

### 2) Error interceptor

This handles errors consistently and can auto-logout on 401/403.

`src/app/_helpers/error.interceptor.ts`

```ts
import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AccountService } from '@app/_services';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
    constructor(private accountService: AccountService) {}

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request).pipe(catchError(err => {
            if ([401, 403].includes(err.status) && this.accountService.accountValue) {
                this.accountService.logout();
            }

            const error = (err && err.error && err.error.message) || err.statusText;
            return throwError(() => error);
        }));
    }
}
```

---

## Part 8: Add an app initializer (restore login on refresh)

When the browser refreshes, Angular loses memory state. The refresh token cookie can restore the session.

`src/app/_helpers/app.initializer.ts`

```ts
import { catchError, of } from 'rxjs';
import { AccountService } from '@app/_services';

export function appInitializer(accountService: AccountService) {
    return () => accountService.refreshToken().pipe(
        catchError(() => of())
    );
}
```

This makes the app attempt a refresh immediately on startup.

---

## Part 9: Protect routes with an AuthGuard (and roles)

Your guard checks:

- Are you logged in?
- If a route requires roles, does your account have one of those roles?

`src/app/_helpers/auth.guard.ts`

```ts
import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AccountService } from '@app/_services';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
    constructor(private router: Router, private accountService: AccountService) {}

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
        const account = this.accountService.accountValue;

        if (account) {
            if (route.data.roles && !route.data.roles.includes(account.role)) {
                this.router.navigate(['/']);
                return false;
            }
            return true;
        }

        this.router.navigate(['/account/login'], { queryParams: { returnUrl: state.url } });
        return false;
    }
}
```

---

## Part 10: Build the account screens (Reactive Forms)

Create an `account` feature module that holds:

- layout component (shared layout for account pages)
- login component
- register component
- verify email component
- forgot password component
- reset password component

Beginner approach:

- Use reactive forms (`FormBuilder`)
- Validate inputs with Angular validators
- Call `AccountService` methods to talk to the API

Example: login component structure

```ts
import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AccountService } from '@app/_services';

@Component({ templateUrl: 'login.component.html', standalone: false })
export class LoginComponent implements OnInit {
    form!: FormGroup;
    submitting = false;
    submitted = false;

    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService
    ) {}

    ngOnInit() {
        this.form = this.formBuilder.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', Validators.required]
        });
    }

    get f() { return this.form.controls; }

    onSubmit() {
        this.submitted = true;
        if (this.form.invalid) return;

        this.submitting = true;
        this.accountService.login(this.f.email.value, this.f.password.value)
            .pipe(first())
            .subscribe({
                next: () => {
                    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
                    this.router.navigateByUrl(returnUrl);
                },
                error: () => {
                    this.submitting = false;
                }
            });
    }
}
```

---

## Part 11: Wire up routing (lazy loading + RBAC)

Create `AppRoutingModule` that:

- Loads `AccountModule` without guards (public)
- Protects the home page and profile routes with `AuthGuard`
- Protects admin routes with `AuthGuard` + `roles: [Role.Admin]`

Example pattern:

```ts
const accountModule = () => import('./account/account.module').then(x => x.AccountModule);
const adminModule = () => import('./admin/admin.module').then(x => x.AdminModule);
const profileModule = () => import('./profile/profile.module').then(x => x.ProfileModule);

const routes: Routes = [
    { path: '', component: HomeComponent, canActivate: [AuthGuard] },
    { path: 'account', loadChildren: accountModule },
    { path: 'profile', loadChildren: profileModule, canActivate: [AuthGuard] },
    { path: 'admin', loadChildren: adminModule, canActivate: [AuthGuard], data: { roles: [Role.Admin] } },
    { path: '**', redirectTo: '' }
];
```

---

## Part 12 (Optional): Add a fake backend for learning

If you’re learning and don’t have a backend yet, a fake backend interceptor can simulate the API in the browser:

- stores accounts in `localStorage`
- generates a “fake JWT”
- generates a “fake refresh token” cookie
- shows “emails” (verify/reset links) as UI alerts

In this repository, you enable it by uncommenting `fakeBackendProvider` in:

- `src/app/app.module.ts`

Once enabled, you can run everything with just:

```bash
npm start
```

---

## Part 13: Run and test

Start Angular:

```bash
npm start
```

Run unit tests:

```bash
npm test
```

---

## Next steps (good beginner exercises)

- Add a “remember me” option (decide whether to auto-refresh immediately or require re-login)
- Add a loading indicator for the initial refresh token call
- Replace the fake backend with a real API and practice debugging CORS + cookies

