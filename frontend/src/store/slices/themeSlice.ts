import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ThemeState {
  mode: 'light' | 'dark';
  language: 'en' | 'vi';
}

const initialState: ThemeState = {
  mode: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  language: (localStorage.getItem('language') as 'en' | 'vi') || 'en',
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', state.mode);
      document.documentElement.classList.toggle('dark', state.mode === 'dark');
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.mode = action.payload;
      localStorage.setItem('theme', action.payload);
      document.documentElement.classList.toggle('dark', action.payload === 'dark');
    },
    setLanguage: (state, action: PayloadAction<'en' | 'vi'>) => {
      state.language = action.payload;
      localStorage.setItem('language', action.payload);
    },
  },
});

export const { toggleTheme, setTheme, setLanguage } = themeSlice.actions;
export default themeSlice.reducer;

