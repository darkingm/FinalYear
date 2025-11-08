import crypto from 'crypto';

export class Helpers {
  static generateId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return prefix ? `${prefix}_${timestamp}${randomStr}` : `${timestamp}${randomStr}`;
  }

  static generateOTP(length: number = 6): string {
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += Math.floor(Math.random() * 10);
    }
    return otp;
  }

  static generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  static hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  static comparePassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  static encrypt(text: string, key: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, '0').substring(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  static decrypt(encrypted: string, key: string): string {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, '0').substring(0, 32)), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  static formatCurrency(amount: number, currency: string = 'USD', locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  }

  static formatNumber(num: number, locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale).format(num);
  }

  static formatDate(date: Date, locale: string = 'en-US'): string {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  static formatDateTime(date: Date, locale: string = 'en-US'): string {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  static formatTimeAgo(date: Date, locale: string = 'en'): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1,
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        return rtf.format(-interval, unit as Intl.RelativeTimeFormatUnit);
      }
    }

    return 'just now';
  }

  static truncate(text: string, length: number, suffix: string = '...'): string {
    if (text.length <= length) return text;
    return text.substring(0, length - suffix.length) + suffix;
  }

  static capitalizeFirst(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  static parseQueryParams(query: Record<string, any>): Record<string, any> {
    const parsed: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      
      // Parse numbers
      if (!isNaN(Number(value)) && value !== '') {
        parsed[key] = Number(value);
      } 
      // Parse booleans
      else if (value === 'true') {
        parsed[key] = true;
      } else if (value === 'false') {
        parsed[key] = false;
      }
      // Parse arrays
      else if (typeof value === 'string' && value.includes(',')) {
        parsed[key] = value.split(',').map(v => v.trim());
      }
      // Keep as string
      else {
        parsed[key] = value;
      }
    }
    
    return parsed;
  }

  static sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;
      
      if (typeof value === 'string') {
        sanitized[key] = value.trim();
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  static unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  static groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((result, item) => {
      const groupKey = String(item[key]);
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    }, {} as Record<string, T[]>);
  }

  static calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  static maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    if (username.length <= 2) return email;
    const masked = username.substring(0, 2) + '*'.repeat(username.length - 2);
    return `${masked}@${domain}`;
  }

  static maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return phone;
    return '*'.repeat(phone.length - 4) + phone.substring(phone.length - 4);
  }

  static maskCardNumber(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\s+/g, '');
    if (cleaned.length <= 4) return cardNumber;
    return '*'.repeat(cleaned.length - 4) + cleaned.substring(cleaned.length - 4);
  }

  static isExpired(date: Date): boolean {
    return new Date() > date;
  }

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  static addMinutes(date: Date, minutes: number): Date {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  static calculateFee(amount: number, feePercentage: number, fixedFee: number = 0): number {
    return (amount * feePercentage) / 100 + fixedFee;
  }

  static roundToDecimals(num: number, decimals: number = 2): number {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}

export default Helpers;

