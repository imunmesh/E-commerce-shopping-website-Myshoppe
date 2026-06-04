import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../utils/api';

export const fetchCompare = createAsyncThunk(
  'compare/fetchCompare',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/compare');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch comparison list');
    }
  }
);

export const addToCompare = createAsyncThunk(
  'compare/addToCompare',
  async (productId, { dispatch, rejectWithValue }) => {
    try {
      const response = await api.post('/compare', { productId });
      dispatch(fetchCompare());
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to add to comparison list');
    }
  }
);

export const removeFromCompare = createAsyncThunk(
  'compare/removeFromCompare',
  async (productId, { dispatch, rejectWithValue }) => {
    try {
      const response = await api.delete(`/compare/${productId}`);
      dispatch(fetchCompare());
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to remove from comparison list');
    }
  }
);

const initialState = {
  items: [],
  loading: false,
  error: null,
};

const compareSlice = createSlice({
  name: 'compare',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompare.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompare.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchCompare.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });
  }
});

export default compareSlice.reducer;
