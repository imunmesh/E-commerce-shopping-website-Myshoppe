import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../utils/api';

// Sync Firebase authenticated user with local DB
export const syncUser = createAsyncThunk(
  'auth/syncUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/auth/sync');
      return response.data.user;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Authentication sync failed');
    }
  }
);

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthState: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = !!action.payload.user;
      state.loading = false;
      state.error = null;
    },
    clearAuthState: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
    },
    setAuthLoading: (state, action) => {
      state.loading = action.payload;
    },
    setAuthError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(syncUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(syncUser.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
      });
  }
});

export const { setAuthState, clearAuthState, setAuthLoading, setAuthError } = authSlice.actions;
export default authSlice.reducer;
