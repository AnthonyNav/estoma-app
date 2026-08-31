export interface Session {
  sessionId: string;
  accessToken: string;
  refreshToken: string | null;
  accountId: string;
  authState: 'NORMAL' | 'PASSWORD_CHANGE_REQUIRED';
  expiresAt: string | null;
}
