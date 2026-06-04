import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../utils/api';
import { fetchCart } from './cartSlice';

export const fetchWishlist = createAsyncThunk(
  'wishlist/fetchWishlist',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/wishlist');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch wishlist');
    }
  }
);

export const addToWishlist = createAsyncThunk(
  'wishlist/addToWishlist',
  async (productId, { dispatch, rejectWithValue }) => {
    try {
      const response = await api.post('/wishlist', { productId });
      dispatch(fetchWishlist());
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to add to wishlist');
    }
  }
);

export const removeFromWishlist = createAsyncThunk(
  'wishlist/removeFromWishlist',
  async (productId, { dispatch, rejectWithValue }) => {
    try {
      const response = await api.delete(`/wishlist/${productId}`);
      dispatch(fetchWishlist());
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to remove from wishlist');
    }
  }
);

export const moveToCart = createAsyncThunk(
  'wishlist/moveToCart',
  async (productId, { dispatch, rejectWithValue }) => {
    try {
      const response = await api.post(`/wishlist/${productId}/move-to-cart`);
      dispatch(fetchWishlist());
      dispatch(fetchCart());
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to move product to cart');
    }
  }
);

const initialState = {
  items: [],
  loading: false,
  error: null,
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });
  }
});

export default wishlistSlice.reducer;
