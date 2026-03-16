import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import http from '../../api/http';
import { Alert } from '../../types';

interface AlertsState {
  alerts: Alert[];
  loading: boolean;
  error: string | null;
}

const initialState: AlertsState = {
  alerts: [],
  loading: false,
  error: null,
};

export const fetchAlerts = createAsyncThunk('alerts/fetchAll', async (params?: { status?: string; severity?: string }) => {
  const res = await http.get('/alerts', { params });
  return res.data;
});

export const acknowledgeAlert = createAsyncThunk('alerts/acknowledge', async (id: string) => {
  const res = await http.patch(`/alerts/${id}/acknowledge`);
  return res.data;
});

export const resolveAlert = createAsyncThunk('alerts/resolve', async (id: string) => {
  const res = await http.patch(`/alerts/${id}/resolve`);
  return res.data;
});

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    addAlert: (state, action) => {
      state.alerts.unshift(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlerts.pending, (state) => { state.loading = true; })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.loading = false;
        state.alerts = action.payload;
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
      .addCase(acknowledgeAlert.fulfilled, (state, action) => {
        const idx = state.alerts.findIndex(a => a._id === action.payload._id);
        if (idx !== -1) state.alerts[idx] = action.payload;
      })
      .addCase(resolveAlert.fulfilled, (state, action) => {
        const idx = state.alerts.findIndex(a => a._id === action.payload._id);
        if (idx !== -1) state.alerts[idx] = action.payload;
      });
  },
});

export const { addAlert } = alertsSlice.actions;
export default alertsSlice.reducer;
