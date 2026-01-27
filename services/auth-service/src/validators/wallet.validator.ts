/**
 * Wallet Validator
 * Validates wallet-related inputs
 */
export class WalletValidator {
  /**
   * Validate coin symbol
   */
  static validateCoinSymbol(coinSymbol: string): { valid: boolean; error?: string } {
    if (!coinSymbol) {
      return { valid: false, error: 'Coin symbol is required' };
    }

    if (typeof coinSymbol !== 'string') {
      return { valid: false, error: 'Coin symbol must be a string' };
    }

    if (coinSymbol.length < 2 || coinSymbol.length > 10) {
      return { valid: false, error: 'Coin symbol must be 2-10 characters' };
    }

    // Check if valid format (letters only)
    if (!/^[A-Z]+$/.test(coinSymbol.toUpperCase())) {
      return { valid: false, error: 'Coin symbol must contain only letters' };
    }

    return { valid: true };
  }

  /**
   * Validate amount
   */
  static validateAmount(amount: number): { valid: boolean; error?: string } {
    if (amount === undefined || amount === null) {
      return { valid: false, error: 'Amount is required' };
    }

    if (typeof amount !== 'number') {
      return { valid: false, error: 'Amount must be a number' };
    }

    if (amount <= 0) {
      return { valid: false, error: 'Amount must be greater than 0' };
    }

    if (amount > 1000000000) {
      return { valid: false, error: 'Amount too large' };
    }

    return { valid: true };
  }

  /**
   * Validate wallet address
   */
  static validateWalletAddress(address: string): { valid: boolean; error?: string } {
    if (!address) {
      return { valid: false, error: 'Wallet address is required' };
    }

    if (typeof address !== 'string') {
      return { valid: false, error: 'Wallet address must be a string' };
    }

    if (address.length < 10 || address.length > 255) {
      return { valid: false, error: 'Invalid wallet address length' };
    }

    return { valid: true };
  }

  /**
   * Validate transfer input
   */
  static validateTransfer(input: {
    fromUserId: string;
    toUserId: string;
    coinSymbol: string;
    amount: number;
  }): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!input.fromUserId) {
      errors.push('From user ID is required');
    }

    if (!input.toUserId) {
      errors.push('To user ID is required');
    }

    if (input.fromUserId === input.toUserId) {
      errors.push('Cannot transfer to yourself');
    }

    const coinValidation = this.validateCoinSymbol(input.coinSymbol);
    if (!coinValidation.valid) {
      errors.push(coinValidation.error!);
    }

    const amountValidation = this.validateAmount(input.amount);
    if (!amountValidation.valid) {
      errors.push(amountValidation.error!);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate deposit/withdrawal input
   */
  static validateTransaction(input: {
    userId: string;
    coinSymbol: string;
    amount: number;
    address?: string;
  }): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!input.userId) {
      errors.push('User ID is required');
    }

    const coinValidation = this.validateCoinSymbol(input.coinSymbol);
    if (!coinValidation.valid) {
      errors.push(coinValidation.error!);
    }

    const amountValidation = this.validateAmount(input.amount);
    if (!amountValidation.valid) {
      errors.push(amountValidation.error!);
    }

    if (input.address) {
      const addressValidation = this.validateWalletAddress(input.address);
      if (!addressValidation.valid) {
        errors.push(addressValidation.error!);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
