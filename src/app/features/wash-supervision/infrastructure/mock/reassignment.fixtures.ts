import { PendingReassignment, ReassignmentCandidate } from '../../domain/models/reassignment';
export const pendingExample = {
  washExecutionId: '44444444-4444-4444-4444-444444444444',
  washExecutionStatus: 'PENDING_REASSIGNMENT',
  authorizedAt: '2026-09-06T15:02:00Z',
  executionVersion: 3,
  appointment: {
    appointmentId: '11111111-1111-1111-1111-111111111111',
    appointmentType: 'NORMAL',
    instrumentCount: 15,
    pieceType: 'HIGH_SPEED',
    appointmentStatus: 'IN_PROGRESS',
    courseSectionReference: {
      courseSectionId: '22222222-2222-2222-2222-222222222222',
      nrc: '12345',
      name: 'Clínica integral',
    },
    appointmentTimeSlot: {
      appointmentTimeSlotId: '33333333-3333-3333-3333-333333333333',
      serviceDate: '2026-09-06',
      startsAt: '2026-09-06T15:00:00Z',
      endsAt: '2026-09-06T16:00:00Z',
      timezone: 'America/Mexico_City',
    },
  },
  student: {
    accountId: '55555555-5555-5555-5555-555555555555',
    personId: '66666666-6666-6666-6666-666666666666',
    displayName: 'Ana García Reyes',
    enrollment: '201945678',
    currentSemester: 7,
    academicStatus: 'ACTIVE',
  },
  activeResourceAssignment: {
    resourceAssignmentId: '77777777-7777-7777-7777-777777777777',
    assignmentType: 'INITIAL',
    assignedAt: '2026-09-06T15:04:00Z',
    cabin: {
      resourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      code: '107',
      name: 'Cabina 107',
    },
    tank: {
      resourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      code: 'B',
      name: 'Tina B',
    },
  },
  submittedExitMaterials: null,
  qrUsageContext: 'NONE',
} as PendingReassignment;
export const candidateExamples: ReassignmentCandidate[] = [
  {
    cabinId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    cabinCode: '108',
    cabinName: 'Cabina 108',
    tankId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    tankCode: 'A',
    tankName: 'Tina A',
    availableCapacity: 2,
  },
  {
    cabinId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    cabinCode: '109',
    cabinName: 'Cabina 109',
    tankId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    tankCode: 'C',
    tankName: 'Tina C',
    availableCapacity: 1,
  },
];
