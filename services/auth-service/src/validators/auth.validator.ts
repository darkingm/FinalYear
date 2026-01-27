/**
 * AuthValidator - Validates authentication inputs
 * Responsibilities:
 * - Email validation
 * - Password validation
 * - Username validation
 * - OTP validation
 * - Registration input validation
 * - Login input validation
 */
export class AuthValidator {
  /**
   * Validate email format
   */
  static validateEmail(email: string): { valid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || email.trim() === '') {
      return { valid: false, error: 'Email is required' };
    }

    if (email.length > 255) {
      return { valid: false, error: 'Email is too long' };
    }

    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Invalid email format' };
    }

    return { valid: true };
  }

  /**
   * Validate password strength
   * Requirements:
   * - At least 8 characters
   * - At least 1 uppercase letter
   * - At least 1 lowercase letter
   * - At least 1 number
   * - At least 1 special character
   */
  static validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password || password.trim() === '') {
      return { valid: false, error: 'Password is required' };
    }

    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters' };
    }

    if (password.length > 128) {
      return { valid: false, error: 'Password is too long' };
    }

    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least 1 uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least 1 lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain at least 1 number' };
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { valid: false, error: 'Password must contain at least 1 special character' };
    }

    return { valid: true };
  }

  /**
   * Validate username
   * Requirements:
   * - 3-20 characters
   * - Only alphanumeric and underscores
   * - Cannot start with a number
   */
  static validateUsername(username: string): { valid: boolean; error?: string } {
    if (!username || username.trim() === '') {
      return { valid: false, error: 'Username is required' };
    }

    if (username.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters' };
    }

    if (username.length > 20) {
      return { valid: false, error: 'Username must be at most 20 characters' };
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(username)) {
      return { valid: false, error: 'Username can only contain letters, numbers, and underscores, and must start with a letter or underscore' };
    }

    return { valid: true };
  }

  /**
   * Validate full name
   */
  static validateFullName(fullName: string): { valid: boolean; error?: string } {
    if (!fullName || fullName.trim() === '') {
      return { valid: false, error: 'Full name is required' };
    }

    if (fullName.length > 255) {
      return { valid: false, error: 'Full name is too long' };
    }

    return { valid: true };
  }

  /**
   * Validate OTP format (6 digits)
   */
  static validateOTP(otp: string): { valid: boolean; error?: string } {
    if (!otp || otp.trim() === '') {
      return { valid: false, error: 'OTP is required' };
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      return { valid: false, error: 'OTP must be 6 digits' };
    }

    return { valid: true };
  }

  /**
   * Validate registration input
   */
  static validateRegistration(data: {
    email?: string;
    username?: string;
    password?: string;
    fullName?: string;
  }): { valid: boolean; errors: { [key: string]: string } } {
    const errors: { [key: string]: string } = {};

    // Validate email
    const emailValidation = this.validateEmail(data.email || '');
    if (!emailValidation.valid) {
      errors.email = emailValidation.error || 'Invalid email';
    }

    // Validate username
    const usernameValidation = this.validateUsername(data.username || '');
    if (!usernameValidation.valid) {
      errors.username = usernameValidation.error || 'Invalid username';
    }

    // Validate password
    const passwordValidation = this.validatePassword(data.password || '');
    if (!passwordValidation.valid) {
      errors.password = passwordValidation.error || 'Invalid password';
    }

    // Validate full name
    if (data.fullName) {
      const fullNameValidation = this.validateFullName(data.fullName);
      if (!fullNameValidation.valid) {
        errors.fullName = fullNameValidation.error || 'Invalid full name';
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validate login input
   */
  static validateLogin(data: {
    email?: string;
    password?: string;
  }): { valid: boolean; errors: { [key: string]: string } } {
    const errors: { [key: string]: string } = {};

    // Validate email
    const emailValidation = this.validateEmail(data.email || '');
    if (!emailValidation.valid) {
      errors.email = emailValidation.error || 'Invalid email';
    }

    // Validate password presence
    if (!data.password || data.password.trim() === '') {
      errors.password = 'Password is required';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validate password reset input
   */
  static validatePasswordReset(data: {
    email?: string;
    otp?: string;
    newPassword?: string;
  }): { valid: boolean; errors: { [key: string]: string } } {
    const errors: { [key: string]: string } = {};

    // Validate email
    const emailValidation = this.validateEmail(data.email || '');
    if (!emailValidation.valid) {
      errors.email = emailValidation.error || 'Invalid email';
    }

    // Validate OTP
    const otpValidation = this.validateOTP(data.otp || '');
    if (!otpValidation.valid) {
      errors.otp = otpValidation.error || 'Invalid OTP';
    }

    // Validate new password
    const passwordValidation = this.validatePassword(data.newPassword || '');
    if (!passwordValidation.valid) {
      errors.newPassword = passwordValidation.error || 'Invalid password';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validate verify email input
   */
  static validateVerifyEmail(data: {
    email?: string;
    otp?: string;
  }): { valid: boolean; errors: { [key: string]: string } } {
    const errors: { [key: string]: string } = {};

    // Validate email
    const emailValidation = this.validateEmail(data.email || '');
    if (!emailValidation.valid) {
      errors.email = emailValidation.error || 'Invalid email';
    }

    // Validate OTP
    const otpValidation = this.validateOTP(data.otp || '');
    if (!otpValidation.valid) {
      errors.otp = otpValidation.error || 'Invalid OTP';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
