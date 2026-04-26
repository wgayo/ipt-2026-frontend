import { ChangeDetectorRef, Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { Subscription } from 'rxjs';

import { Alert, AlertType } from '@app/_models';
import { AlertService } from '@app/_services';

@Component({ selector: 'alert', templateUrl: 'alert.component.html', standalone: false })
export class AlertComponent implements OnInit, OnDestroy {
    private scheduleDetectChanges() {
        setTimeout(() => this.cdr.detectChanges());
    }
    @Input() id = 'default-alert';
    @Input() fade = true;

    alerts: Alert[] = [];
    alertSubscription!: Subscription;
    routeSubscription!: Subscription;

    constructor(
        private router: Router,
        private alertService: AlertService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        // subscribe to new alert notifications
        this.alertSubscription = this.alertService.onAlert(this.id)
            .subscribe(alert => {
                // clear alerts when an empty alert is received
                if (!alert.message) {
                    this.alerts = this.alerts.filter(x => x.keepAfterRouteChange);
                    this.alerts.forEach(x => delete x.keepAfterRouteChange);
                    this.scheduleDetectChanges();
                    return;
                }

                this.alerts.push(alert);
                this.scheduleDetectChanges();

                if (alert.autoClose) {
                    setTimeout(() => this.removeAlert(alert), 3000);
                }
            });

        // clear alerts on location change
        this.routeSubscription = this.router.events.subscribe(event => {
            if (event instanceof NavigationStart) {
                this.alertService.clear(this.id);
                this.scheduleDetectChanges();
            }
        });
    }

    ngOnDestroy() {
        // unsubscribe to avoid memory leaks
        this.alertSubscription.unsubscribe();
        this.routeSubscription.unsubscribe();
    }

    removeAlert(alert: Alert) {
        // check if already removed to prevent error on auto close
        if (!this.alerts.includes(alert)) return;

        if (this.fade) {
            alert.fade = true;
            this.scheduleDetectChanges();

            setTimeout(() => {
                this.alerts = this.alerts.filter(x => x !== alert);
                this.scheduleDetectChanges();
            }, 250);
        } else {
            this.alerts = this.alerts.filter(x => x !== alert);
            this.scheduleDetectChanges();
        }
    }

    cssClasses(alert: Alert) {
        if (!alert) return;

        const classes = ['alert', 'alert-dismissible', 'mt-4', 'container'];

        const alertTypeClass = {
            [AlertType.Success]: 'alert-success',
            [AlertType.Error]: 'alert-danger',
            [AlertType.Info]: 'alert-info',
            [AlertType.Warning]: 'alert-warning'
        }

        if (alert.type !== undefined) {
            classes.push(alertTypeClass[alert.type]);
        }

        if (alert.fade) {
            classes.push('fade');
        }

        return classes.join(' ');
    }
}
