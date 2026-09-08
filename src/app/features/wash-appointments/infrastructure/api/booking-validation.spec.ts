import { validateAccepted } from './booking-validation';
import { AcceptedOperation } from '../../domain/models/appointment-registration';
describe('Accepted operation replays', () => {
  const receipt: AcceptedOperation = {
    operationId: '00000000-0000-4000-8000-000000000009',
    status: 'PENDING',
    pollPath: '/api/v1/operations/00000000-0000-4000-8000-000000000009',
    submittedAt: '2026-09-06T19:56:00Z',
  };
  for (const status of ['PENDING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'EXPIRED'] as const) {
    it(`accepts an idempotent receipt with status ${status}`, () => {
      expect(validateAccepted({ ...receipt, status })).toEqual({ ...receipt, status });
    });
  }
  it('rejects a receipt whose poll path points at a different operation', () => {
    expect(() =>
      validateAccepted({ ...receipt, status: 'SUCCEEDED', pollPath: '/api/v1/operations/other' }),
    ).toThrow();
  });
});
