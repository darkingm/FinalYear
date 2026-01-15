import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { P2PTrade } from '../../api/types';

interface P2PState {
  trades: P2PTrade[];
  currentTrade: P2PTrade | null;
  loading: boolean;
  error: string | null;
}

const initialState: P2PState = {
  trades: [],
  currentTrade: null,
  loading: false,
  error: null,
};

const p2pSlice = createSlice({
  name: 'p2p',
  initialState,
  reducers: {
    setTrades: (state, action: PayloadAction<P2PTrade[]>) => {
      state.trades = action.payload;
    },
    addTrade: (state, action: PayloadAction<P2PTrade>) => {
      state.trades.unshift(action.payload);
    },
    setCurrentTrade: (state, action: PayloadAction<P2PTrade | null>) => {
      state.currentTrade = action.payload;
    },
    updateTrade: (state, action: PayloadAction<Partial<P2PTrade> & { id: string }>) => {
      const index = state.trades.findIndex((t) => t.id === action.payload.id);
      if (index !== -1) {
        state.trades[index] = { ...state.trades[index], ...action.payload };
      }
      if (state.currentTrade?.id === action.payload.id) {
        state.currentTrade = { ...state.currentTrade, ...action.payload };
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

export const { setTrades, addTrade, setCurrentTrade, updateTrade, setLoading, setError } = p2pSlice.actions;
export default p2pSlice.reducer;


