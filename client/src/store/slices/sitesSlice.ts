import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import http from '../../api/http';
import { ProductionSite, AssemblyLine } from '../../types';

interface SitesState {
  sites: ProductionSite[];
  lines: AssemblyLine[];
  loading: boolean;
}

const initialState: SitesState = {
  sites: [],
  lines: [],
  loading: false,
};

export const fetchSites = createAsyncThunk('sites/fetchAll', async () => {
  const res = await http.get('/sites');
  return res.data;
});

export const fetchLines = createAsyncThunk('sites/fetchLines', async (siteId?: string) => {
  const res = await http.get('/lines', { params: siteId ? { site_id: siteId } : {} });
  return res.data;
});

const sitesSlice = createSlice({
  name: 'sites',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSites.pending, (state) => { state.loading = true; })
      .addCase(fetchSites.fulfilled, (state, action) => {
        state.loading = false;
        state.sites = action.payload;
      })
      .addCase(fetchLines.fulfilled, (state, action) => {
        state.lines = action.payload;
      });
  },
});

export default sitesSlice.reducer;
