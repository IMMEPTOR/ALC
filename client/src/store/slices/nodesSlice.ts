import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import http from '../../api/http';
import { TechNode, LatestTelemetry } from '../../types';

interface NodesState {
  nodes: TechNode[];
  selectedNode: TechNode | null;
  latestTelemetry: LatestTelemetry[];
  loading: boolean;
  error: string | null;
}

const initialState: NodesState = {
  nodes: [],
  selectedNode: null,
  latestTelemetry: [],
  loading: false,
  error: null,
};

export const fetchNodes = createAsyncThunk('nodes/fetchAll', async (params?: { line_id?: string; status?: string }) => {
  const res = await http.get('/nodes', { params });
  return res.data;
});

export const fetchNodeById = createAsyncThunk('nodes/fetchById', async (id: string) => {
  const res = await http.get(`/nodes/${id}`);
  return res.data;
});

export const fetchLatestTelemetry = createAsyncThunk('nodes/fetchTelemetry', async (nodeId: string) => {
  const res = await http.get(`/telemetry/latest/${nodeId}`);
  return res.data;
});

const nodesSlice = createSlice({
  name: 'nodes',
  initialState,
  reducers: {
    updateNodeStatus: (state, action) => {
      const { nodeId, status } = action.payload;
      const node = state.nodes.find(n => n._id === nodeId);
      if (node) node.status = status;
      if (state.selectedNode?._id === nodeId) state.selectedNode.status = status;
    },
    updateTelemetryValue: (state, action) => {
      const { param_id, value, timestamp } = action.payload;
      const t = state.latestTelemetry.find(lt => lt.param_id === param_id);
      if (t) {
        t.value = value;
        t.timestamp = timestamp;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNodes.pending, (state) => { state.loading = true; })
      .addCase(fetchNodes.fulfilled, (state, action) => {
        state.loading = false;
        state.nodes = action.payload;
      })
      .addCase(fetchNodes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
      .addCase(fetchNodeById.fulfilled, (state, action) => {
        state.selectedNode = action.payload;
      })
      .addCase(fetchLatestTelemetry.fulfilled, (state, action) => {
        state.latestTelemetry = action.payload;
      });
  },
});

export const { updateNodeStatus, updateTelemetryValue } = nodesSlice.actions;
export default nodesSlice.reducer;
