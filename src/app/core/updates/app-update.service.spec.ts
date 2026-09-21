import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService, RELOAD_APP, APP_STABLE } from './app-update.service';
import { UpdateSafetyService } from './update-safety.service';

describe('AppUpdateService', () => {
  let service: AppUpdateService;
  let events: Subject<unknown>;
  let broken: Subject<unknown>;
  let reload: jasmine.Spy;
  let reason: string | null;
  let router: { url: string };
  let sw: {
    isEnabled: boolean;
    versionUpdates: Subject<unknown>;
    unrecoverable: Subject<unknown>;
    checkForUpdate: jasmine.Spy;
  };
  beforeEach(() => {
    sessionStorage.removeItem('estoma.update.auto');
    events = new Subject();
    broken = new Subject();
    reload = jasmine.createSpy('reload');
    reason = null;
    router = { url: '/wash/supervision' };
    sw = {
      isEnabled: true,
      versionUpdates: events,
      unrecoverable: broken,
      checkForUpdate: jasmine.createSpy('check').and.resolveTo(false),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: sw },
        { provide: Router, useValue: router },
        { provide: APP_STABLE, useValue: new Subject<boolean>() },
        { provide: UpdateSafetyService, useValue: { reason: () => reason } },
        { provide: RELOAD_APP, useValue: reload },
      ],
    });
    service = TestBed.inject(AppUpdateService);
  });
  afterEach(() => sessionStorage.removeItem('estoma.update.auto'));
  const ready = () => ({
    type: 'VERSION_READY',
    latestVersion: { hash: 'new-version' },
    currentVersion: { hash: 'old-version' },
  });
  it('offers an update without auto reloading an authenticated workflow', () => {
    events.next(ready());
    expect(service.ready()).toBeTrue();
    expect(reload).not.toHaveBeenCalled();
    service.apply();
    expect(reload).toHaveBeenCalledTimes(1);
    service.apply();
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('rechecks safety at click time, not just when the banner was shown', () => {
    events.next(ready());
    reason = 'pending';
    service.apply();
    expect(reload).not.toHaveBeenCalled();
    expect(service.blockedReason()).toBe('pending');
    reason = null;
    service.apply();
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('automatically reloads only a safe login, once per downloaded version', () => {
    router.url = '/authentication/sign-in';
    events.next(ready());
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('estoma.update.auto')).toBe('new-version');
  });
  it('never automatically reloads login with captured data', () => {
    router.url = '/authentication/sign-in';
    reason = 'form';
    events.next(ready());
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('estoma.update.auto')).toBeNull();
  });
  it('does not repeat automatic reload when the version marker already exists', () => {
    sessionStorage.setItem('estoma.update.auto', 'new-version');
    router.url = '/authentication/sign-in';
    events.next(ready());
    expect(reload).not.toHaveBeenCalled();
  });
  it('handles unrecoverable state without erasing or force reloading pending work', () => {
    reason = 'pending';
    broken.next({ reason: 'chunk absent' });
    service.apply();
    expect(service.broken()).toBeTrue();
    expect(service.ready()).toBeTrue();
    expect(reload).not.toHaveBeenCalled();
  });
  it('deduplicates checks and allows an explicit retry after network failure', async () => {
    sw.checkForUpdate.and.rejectWith(new Error('offline'));
    await service.check();
    await service.check();
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(service.checking()).toBeFalse();
    expect(service.message()).toContain('conexión');
    sw.checkForUpdate.and.resolveTo(false);
    await service.check(true);
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(2);
  });
  it('does not reload without a ready version', () => {
    service.apply();
    expect(reload).not.toHaveBeenCalled();
  });
  it('recovers an update already installed by another tab before subscription', () => {
    events.next({
      type: 'NO_NEW_VERSION_DETECTED',
      version: { hash: 'installed', appData: { commit: 'another-commit' } },
    });
    expect(service.ready()).toBeTrue();
    expect(reload).not.toHaveBeenCalled();
    service.apply();
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('does not interpret false as a successful update check or hide install failure', async () => {
    sw.checkForUpdate.and.callFake(async () => {
      events.next({
        type: 'VERSION_INSTALLATION_FAILED',
        version: { hash: 'broken' },
        error: 'offline',
      });
      return false;
    });
    await service.check(true);
    expect(service.message()).toContain('No se pudo preparar');
    expect(service.ready()).toBeFalse();
  });
});
