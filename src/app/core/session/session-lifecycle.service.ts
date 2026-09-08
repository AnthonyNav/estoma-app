import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionLifecycleService {
  private readonly ended = new Subject<void>();
  readonly ended$ = this.ended.asObservable();

  end(): void {
    this.ended.next();
  }
}
