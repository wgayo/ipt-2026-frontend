import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize, first } from 'rxjs/operators';

import { AccountService, AlertService } from '@app/_services';
import { MustMatch } from '@app/_helpers';

@Component({ templateUrl: 'add-edit.component.html', standalone: false })
export class AddEditComponent implements OnInit, OnDestroy {
    form!: FormGroup;
    id?: string;
    title!: string;
    loading = false;
    submitting = false;
    submitted = false;

    private loadTimeoutId?: number;

    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.id = this.route.snapshot.params['id'];

        this.form = this.formBuilder.group({
            title: ['', Validators.required],
            firstName: ['', Validators.required],
            lastName: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            role: ['', Validators.required],
            // password only required in add mode
            password: ['', [Validators.minLength(6), ...(!this.id ? [Validators.required] : [])]],
            confirmPassword: ['']
        }, {
            validator: MustMatch('password', 'confirmPassword')
        });

        this.title = 'Create Account';
        if (this.id) {
            this.title = 'Edit Account';
            this.loading = true;
            this.cdr.detectChanges();

            this.loadTimeoutId = window.setTimeout(() => {
                if (this.loading) {
                    this.loading = false;
                    this.alertService.error('Request timed out');
                    this.cdr.detectChanges();
                }
            }, 10000);

            this.accountService.getById(this.id)
                .pipe(
                    first(),
                    finalize(() => {
                        this.loading = false;
                        if (this.loadTimeoutId) {
                            window.clearTimeout(this.loadTimeoutId);
                            this.loadTimeoutId = undefined;
                        }
                        this.cdr.detectChanges();
                    })
                )
                .subscribe({
                    next: x => {
                        this.form.patchValue(x);
                        this.cdr.detectChanges();
                    },
                    error: error => {
                        this.alertService.error(error);
                        this.cdr.detectChanges();
                    }
                });
        }
    }

    ngOnDestroy() {
        if (this.loadTimeoutId) {
            window.clearTimeout(this.loadTimeoutId);
            this.loadTimeoutId = undefined;
        }
    }

    // convenience getter for easy access to form fields
    get f() { return this.form.controls; }

    onSubmit() {
        this.submitted = true;
        this.cdr.detectChanges();

        this.alertService.clear();

        if (this.form.invalid) {
            return;
        }

        this.submitting = true;
        this.cdr.detectChanges();

        // create or update account based on id param
        let saveAccount;
        let message: string;
        if (this.id) {
            saveAccount = () => this.accountService.update(this.id!, this.form.value);
            message = 'Account updated';
        } else {
            saveAccount = () => this.accountService.create(this.form.value);
            message = 'Account created';
        }

        saveAccount()
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success(message, { keepAfterRouteChange: true });
                    this.router.navigateByUrl('/admin/accounts');
                },
                error: error => {
                    this.alertService.error(error);
                    this.submitting = false;
                    this.cdr.detectChanges();
                }
            });
    }
}