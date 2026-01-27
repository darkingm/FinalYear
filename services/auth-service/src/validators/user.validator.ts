/**
 * UserValidator - Validates user profile inputs
 * Responsibilities:
 * - Profile field validation
 * - Balance validation
 * - Privacy settings validation
 * - Withdrawal input validation
 */
export class UserValidator {
  /**
   * Validate full name
   */
  static validateFullName(fullName: string): { valid: boolean; error?: string } {
    if (fullName && fullName.length > 255) {
      return { valid: false, error: 'Full name is too long' };
    }
    return { valid: true };
  }

  /**
   * Validate phone number
   */
  static validatePhone(phone: string): { valid: boolean; error?: string } {
    if (!phone) return { valid: true }; // Optional field

    if (phone.length > 20) {
      return { valid: false, error: 'Phone number is too long' };
    }

    if (!/^[\d\s\-\+\(\)]+$/.test(phone)) {
      return { valid: false, error: 'Invalid phone number format' };
    }

    return { valid: true };
  }

  /**
   * Validate bio
   */
  static validateBio(bio: string): { valid: boolean; error?: string } {
    if (!bio) return { valid: true }; // Optional field

    if (bio.length > 500) {
      return { valid: false, error: 'Bio is too long (max 500 characters)' };
    }

    return { valid: true };
  }

  /**
   * Validate country
   */
  static validateCountry(country: string): { valid: boolean; error?: string } {
    if (!country) return { valid: true }; // Optional field

    if (country.length > 100) {
      return { valid: false, error: 'Country name is too long' };
    }

    return { valid: true };
  }

  /**
   * Validate city
   */
  static validateCity(city: string): { valid: boolean; error?: string } {
    if (!city) return { valid: true }; // Optional field

    if (city.length > 100) {
      return { valid: false, error: 'City name is too long' };
    }

    return { valid: true };
  }

  /**
   * Validate address
   */
  static validateAddress(address: string): { valid: boolean; error?: string } {
    if (!address) return { valid: true }; // Optional field

    if (address.length > 500) {
      return { valid: false, error: 'Address is too long' };
    }

    return { valid: true };
  }

  /**
   * Validate date of birth
   */
  static validateDateOfBirth(dob: string): { valid: boolean; error?: string } {
    if (!dob) return { valid: true }; // Optional field

    const date = new Date(dob);
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Invalid date format' };
    }

    const age = new Date().getFullYear() - date.getFullYear();
    if (age < 13) {
      return { valid: false, error: 'User must be at least 13 years old' };
    }

    if (age > 150) {
      return { valid: false, error: 'Invalid date of birth' };
    }

    return { valid: true };
  }

  /**
   * Validate privacy settings
   */
  static validatePrivacySettings(data: {
    showCoinBalance?: boolean;
    showJoinDate?: boolean;
    showEmail?: boolean;
    showPhone?: boolean;
  }): { valid: boolean; errors: { [key: string]: string } } {
    const errors: { [key: string]: string } = {};

    if (typeof data.showCoinBalance !== 'undefined' && typeof data.showCoinBalance !== 'boolean') {
      errors.showCoinBalance = 'Must be a boolean';
    }

    if (typeof data.showJoinDate !== 'undefined' && typeof data.showJoinDate !== 'boolean') {
      errors.showJoinDate = 'Must be a boolean';
    }

    if (typeof data.showEmail !== 'undefined' && typeof data.showEmail !== 'boolean') {
      errors.showEmail = 'Must be a boolean';
    }

    if (typeof data.showPhone !== 'undefined' && typeof data.showPhone !== 'boolean') {
      errors.showPhone = 'Must be a boolean';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validate balance input
   */
  static validateBalance(amount: number): { valid: boolean; error?: string } {
    if (!amount || typeof amount !== 'number') {
      return { valid: false, error: 'Amount must be a number' };
    }

    if (amount <= 0) {
      return { valid: false, error: 'Amount must be greater than 0' };
    }

    if (amount > 999999999) {
      return { valid: false, error: 'Amount is too large' };
    }

    return { valid: true };
  }

  /**
   * Validate coin ID
   */
  static validateCoinId(coinId: string): { valid: boolean; error?: string } {
    if (!coinId || coinId.trim() === '') {
      return { valid: false, error: 'Coin ID is required' };
    }

    return { valid: true };
  }

  /**
   * Validate wallet address
   */
  static validateWalletAddress(address: string): { valid: boolean; error?: string } {
    if (!address || address.trim() === '') {
      return { valid: false, error: 'Wallet address is required' };
    }

    // Ethereum address format (0x + 40 hex chars)
    const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    // Bitcoin address format (starts with 1, 3, or bc1)
    const bitcoinAddressRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/;

    if (!ethereumAddressRegex.test(address) && !bitcoinAddressRegex.test(address)) {
      return { valid: false, error: 'Invalid wallet address format' };
    }

    return { valid: true };
  }

  /**
   * Validate withdrawal input
   */
  static validateWithdrawal(data: {
    coinId?: string;
    coinSymbol?: string;
    amount?: number;
    walletAddress?: string;
    network?: string;
  }): { valid: boolean; errors: { [key: string]: string } } {
    const errors: { [key: string]: string } = {};

    // Validate coin ID
    const coinIdValidation = this.validateCoinId(data.coinId || '');
    if (!coinIdValidation.valid) {
      errors.coinId = coinIdValidation.error || 'Invalid coin ID';
    }

    // Validate coin symbol
    if (!data.coinSymbol || data.coinSymbol.trim() === '') {
      errors.coinSymbol = 'Coin symbol is required';
    }

    // Validate amount
    const amountValidation = this.validateBalance(data.amount || 0);
    if (!amountValidation.valid) {
      errors.amount = amountValidation.error || 'Invalid amount';
    }

    // Validate wallet address
    const addressValidation = this.validateWalletAddress(data.walletAddress || '');
    if (!addressValidation.valid) {
      errors.walletAddress = addressValidation.error || 'Invalid wallet address';
    }

    // Validate network
    if (!data.network || data.network.trim() === '') {
      errors.network = 'Network is required';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validate profile update input
   */
  static validateProfileUpdate(data: {
    fullName?: string;
    bio?: string;
    phone?: string;
    dateOfBirth?: string;
    country?: string;
    city?: string;
    address?: string;
    avatar?: string;
  }): { valid: boolean; errors: { [key: string]: string } } {
    const errors: { [key: string]: string } = {};

    if (data.fullName) {
      const validation = this.validateFullName(data.fullName);
      if (!validation.valid) errors.fullName = validation.error || 'Invalid full name';
    }

    if (data.bio) {
      const validation = this.validateBio(data.bio);
      if (!validation.valid) errors.bio = validation.error || 'Invalid bio';
    }

    if (data.phone) {
      const validation = this.validatePhone(data.phone);
      if (!validation.valid) errors.phone = validation.error || 'Invalid phone';
    }

    if (data.dateOfBirth) {
      const validation = this.validateDateOfBirth(data.dateOfBirth);
      if (!validation.valid) errors.dateOfBirth = validation.error || 'Invalid date of birth';
    }

    if (data.country) {
      const validation = this.validateCountry(data.country);
      if (!validation.valid) errors.country = validation.error || 'Invalid country';
    }

    if (data.city) {
      const validation = this.validateCity(data.city);
      if (!validation.valid) errors.city = validation.error || 'Invalid city';
    }

    if (data.address) {
      const validation = this.validateAddress(data.address);
      if (!validation.valid) errors.address = validation.error || 'Invalid address';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
