export interface SupervisorHome {
  serviceDate: string;
  pendingReassignmentsCount: number;
  summary: {
    registeredAppointments: number;
    inProcessAppointments: number;
    completedAppointments: number;
    deniedAppointments: number;
    cancelledAppointments: number;
  };
}
