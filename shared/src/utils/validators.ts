import { REGEX_PATTERNS } from './constants';

export class Validator {
  static isEmail(email: string): boolean {
    return REGEX_PATTERNS.EMAIL.test(email);
  }

  static isPassword(password: string): boolean {
    // At least 8 characters, one uppercase, one lowercase, one number, one special character
    return REGEX_PATTERNS.PASSWORD.test(password);
  }

  static isPhoneNumber(phone: string): boolean {
    return REGEX_PATTERNS.PHONE.test(phone);
  }

  static isUsername(username: string): boolean {
    return REGEX_PATTERNS.USERNAME.test(username);
  }

  static isEthereumAddress(address: string): boolean {
    return REGEX_PATTERNS.ETHEREUM_ADDRESS.test(address);
  }

  static isTransactionHash(hash: string): boolean {
    return REGEX_PATTERNS.TRANSACTION_HASH.test(hash);
  }

  static isUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isPositiveNumber(value: any): boolean {
    const num = Number(value);
    return !isNaN(num) && num > 0;
  }

  static isValidDate(date: any): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  static isValidEnum<T extends object>(enumObj: T, value: any): boolean {
    return Object.values(enumObj).includes(value);
  }

  static lengthBetween(str: string, min: number, max: number): boolean {
    return str.length >= min && str.length <= max;
  }

  static isAlphanumeric(str: string): boolean {
    return /^[a-zA-Z0-9]+$/.test(str);
  }

  static isCreditCard(cardNumber: string): boolean {
    // Luhn algorithm
    const sanitized = cardNumber.replace(/\s+/g, '');
    if (!/^\d{13,19}$/.test(sanitized)) return false;

    let sum = 0;
    let shouldDouble = false;

    for (let i = sanitized.length - 1; i >= 0; i--) {
      let digit = parseInt(sanitized.charAt(i), 10);

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }

  static isValidOTP(otp: string, length: number = 6): boolean {
    const regex = new RegExp(`^\\d{${length}}$`);
    return regex.test(otp);
  }

  static sanitizeString(str: string): string {
    return str.trim().replace(/[<>]/g, '');
  }

  static isValidImageType(mimetype: string): boolean {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    return allowedTypes.includes(mimetype);
  }

  static isValidFileSize(size: number, maxSize: number = 10 * 1024 * 1024): boolean {
    return size > 0 && size <= maxSize;
  }
}

export const validateEmail = (email: string): { valid: boolean; message?: string } => {
  if (!email) {
    return { valid: false, message: 'Email is required' };
  }
  if (!Validator.isEmail(email)) {
    return { valid: false, message: 'Invalid email format' };
  }
  return { valid: true };
};

export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (!password) {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!Validator.isPassword(password)) {
    return {
      valid: false,
      message: 'Password must contain uppercase, lowercase, number, and special character',
    };
  }
  return { valid: true };
};

export const validateUsername = (username: string): { valid: boolean; message?: string } => {
  if (!username) {
    return { valid: false, message: 'Username is required' };
  }
  if (!Validator.isUsername(username)) {
    return { valid: false, message: 'Username must be 3-20 characters, alphanumeric, underscore, or dash' };
  }
  return { valid: true };
};

export const validatePhoneNumber = (phone: string): { valid: boolean; message?: string } => {
  if (!phone) {
    return { valid: false, message: 'Phone number is required' };
  }
  if (!Validator.isPhoneNumber(phone)) {
    return { valid: false, message: 'Invalid phone number format' };
  }
  return { valid: true };
};

