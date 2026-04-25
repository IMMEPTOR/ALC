import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import http from '../../api/http';
import { AuthState } from '../../types';
import { connectSocket, disconnectSocket } from '../../api/socket';

const STORAGE_KEY = 'alc_auth';

function saveToStorage(token: string, user: any) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user })); } catch {}
}

function loadFromStorage(): { token: string; user: any } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function clearStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// Role restrictions per platform:
// Mobile (android/ios) = operator only
// Web = engineer only
// Desktop (Electron) = admin only (handled in Electron's own UI)
function getAllowedRoles(): string[] {
  if (Platform.OS === 'web') return ['engineer'];
  return ['operator']; // mobile
}

function getRoleLabel(): string {
  if (Platform.OS === 'web') return 'инженеров';
  return 'операторов';
}

const saved = loadFromStorage();

const initialState: AuthState = {
  token: saved?.token || null,
  user: saved?.user || null,
  loading: false,
  error: null,
};

if (saved?.token) {
  connectSocket(saved.token);
}

export const login = createAsyncThunk(
  'auth/login',
  async ({ username, password }: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await http.post('/auth/login', { username, password });
      const token = res.data.access_token;

      const meRes = await http.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = meRes.data.user;

      // Check role restriction
      const allowed = getAllowedRoles();
      if (!allowed.includes(user.role)) {
        return rejectWithValue(`Данный клиент поддерживает авторизацию только для ${getRoleLabel()}`);
      }

      connectSocket(token);
      saveToStorage(token, user);

      return { token, user };
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
      clearStorage();
      disconnectSocket();
    },
    clearError: (state) => {
      state.error = null;
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

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
