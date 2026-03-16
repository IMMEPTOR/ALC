import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import nodesReducer from './slices/nodesSlice';
import alertsReducer from './slices/alertsSlice';
import sitesReducer from './slices/sitesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    nodes: nodesReducer,
    alerts: alertsReducer,
    sites: sitesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
