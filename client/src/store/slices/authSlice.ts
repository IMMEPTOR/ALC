import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import http from '../../api/http';
import { AuthState } from '../../types';
import { connectSocket, disconnectSocket } from '../../api/socket';

const initialState: AuthState = {
  token: null,
  user: null,
  loading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async ({ username, password }: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await http.post('/auth/login', { username, password });
      connectSocket(res.data.token);
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Ошибка авторизации');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.token = null;
      state.user = null;
      disconnectSocket();
    },
    clearError: (state) => {
      state.error = null;
    },
    restoreToken: (state, action) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { logout, clearError, restoreToken } = authSlice.actions;
export default authSlice.reducer;
