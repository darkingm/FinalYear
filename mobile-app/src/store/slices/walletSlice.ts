import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CoinBalance, Coin } from '../../api/types';

interface WalletState {
  balances: CoinBalance[];
  coins: Coin[];
  loading: boolean;
  error: string | null;
}

const initialState: WalletState = {
  balances: [],
  coins: [],
  loading: false,
  error: null,
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setBalances: (state, action: PayloadAction<CoinBalance[]>) => {
      state.balances = action.payload;
    },
    setCoins: (state, action: PayloadAction<Coin[]>) => {
      state.coins = action.payload;
    },
    updateBalance: (state, action: PayloadAction<{ coinId: string; balance: number }>) => {
      const balance = state.balances.find((b) => b.coinId === action.payload.coinId);
      if (balance) {
        balance.balance = action.payload.balance;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setBalances, setCoins, updateBalance, setLoading, setError } = walletSlice.actions;
export default walletSlice.reducer;


