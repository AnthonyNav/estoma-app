export type SystemCode = 'LAVADO_ULTRASONICO' | 'PRACTICAS_PROFESIONALES';
export type AuthState = 'NORMAL' | 'PASSWORD_CHANGE_REQUIRED';
export interface LoginResponse {
  accountId?: string | null;
  sessionId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  authState?: string | null;
}
export interface Session {
  accountId: string;
  sessionId: string;
  accessToken: string;
  refreshToken: string | null;
  authState: AuthState;
  accessExpiresAt: number;
}
export interface SessionProfile {
  accountId: string;
  personId: string;
  displayName: string;
  loginType: string;
  loginIdentifier: string;
  institutionalEmail: string;
  roleCode: string;
  availableSystemCodes: string[];
}
export interface RefreshResponse {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
}
export const SYSTEM_LABELS: Record<SystemCode, string> = {
  LAVADO_ULTRASONICO: 'Lavado Ultrasónico',
  PRACTICAS_PROFESIONALES: 'Prácticas Profesionales',
};
