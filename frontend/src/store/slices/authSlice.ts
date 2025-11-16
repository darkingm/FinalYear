import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Helper function to check if token is valid (not expired)
const isTokenValid = (token: string | null): boolean => {
  if (!token) return false;
  
  try {
    // JWT structure: header.payload.signature
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = payload.exp * 1000; // Convert to milliseconds
    return Date.now() < expiry;
  } catch (error) {
    return false;
  }
};

// ✅ Helper function to decode user from token
const decodeUserFromToken = (token: string | null): User | null => {
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.id || payload.userId || '',
      email: payload.email || '',
      username: payload.username || '',
      fullName: payload.fullName || payload.name || '',
      role: payload.role || 'USER',
      avatar: payload.avatar,
    };
  } catch (error) {
    return null;
  }
};

const storedAccessToken = localStorage.getItem('accessToken');
const storedRefreshToken = localStorage.getItem('refreshToken');

// Only use tokens if they are valid
const validAccessToken = isTokenValid(storedAccessToken) ? storedAccessToken : null;
const validRefreshToken = isTokenValid(storedRefreshToken) ? storedRefreshToken : null;

// ✅ Decode user from token if token is valid
const decodedUser = validAccessToken ? decodeUserFromToken(validAccessToken) : null;

// Clear invalid tokens from localStorage
if (!validAccessToken) {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

const initialState: AuthState = {
  user: decodedUser, // ✅ Set user từ decoded token
  accessToken: validAccessToken,
  refreshToken: validRefreshToken,
  isAuthenticated: !!validAccessToken,
  isLoading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; accessToken: string; refreshToken: string }>
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
      localStorage.setItem('accessToken', action.payload.accessToken);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setCredentials, setUser, logout, setLoading } = authSlice.actions;
export default authSlice.reducer;

