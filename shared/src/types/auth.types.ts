export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface IAuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
  isEmailVerified: boolean;
}

export enum AuthProvider {
  LOCAL = 'LOCAL',
  GOOGLE = 'GOOGLE',
  FACEBOOK = 'FACEBOOK',
  MICROSOFT = 'MICROSOFT',
}

export interface IOAuthProfile {
  provider: AuthProvider;
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IRegisterRequest {
  email: string;
  username: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
}

export interface IVerifyOTPRequest {
  email: string;
  otp: string;
  type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'TWO_FACTOR';
}

export interface IResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export interface IChangePasswordRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

