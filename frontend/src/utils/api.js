import axios from 'axios';
import { auth } from '../firebase/config';

let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
if (!baseUrl.endsWith('/api')) {
  baseUrl = baseUrl.replace(/\/$/, '') + '/api';
}

const api = axios.create({
  baseURL: baseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically inject Firebase JWT token in Authorization header
api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (err) {
        console.error('Failed to retrieve Firebase ID token:', err);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
