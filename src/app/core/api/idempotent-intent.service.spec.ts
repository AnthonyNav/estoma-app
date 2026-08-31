import { TestBed } from '@angular/core/testing';

import { IdempotentIntentService } from './idempotent-intent.service';

describe('IdempotentIntentService', () => {
  it('reuses a key until the intention receives a terminal result', () => {
    const service = TestBed.inject(IdempotentIntentService);
    const first = service.key('wash.exit:execution-1:1');

    expect(service.key('wash.exit:execution-1:1')).toBe(first);

    service.complete('wash.exit:execution-1:1');
    expect(service.key('wash.exit:execution-1:1')).not.toBe(first);
  });
});
