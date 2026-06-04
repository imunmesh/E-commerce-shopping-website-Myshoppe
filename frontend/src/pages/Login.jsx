import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { auth, signInWithEmailAndPassword } from '../firebase/config';
import { syncUser, setAuthError, setAuthLoading } from '../store/authSlice';

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    dispatch(setAuthLoading(true));

    try {
      // 1. Sign in via Firebase Auth
      await signInWithEmailAndPassword(auth, email, password);
      
      // 2. Synchronize details in PostgreSQL (creates or retrieves local record)
      await dispatch(syncUser()).unwrap();
      
      // 3. Success -> Redirect
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      let errMsg = 'Failed to sign in. Please verify your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errMsg = 'Invalid email or password.';
      } else if (err.code === 'auth/invalid-credential') {
        errMsg = 'Incorrect email or password credentials.';
      }
      setLocalError(errMsg);
      dispatch(setAuthError(errMsg));
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 w-full max-w-md">
        
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-2xl font-black text-amazon-blue">
            My<span className="text-amazon-yellow">Shopee</span>
          </span>
          <h2 className="text-xl font-bold text-gray-800 mt-3">Sign In to Your Account</h2>
          <p className="text-sm text-gray-400 mt-1">Access your shopping cart, orders, and track deliveries.</p>
        </div>

        {/* Error message */}
        {(localError || error) && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-red-600 text-sm font-semibold flex items-center space-x-2 mb-6">
            <AlertCircle size={18} className="shrink-0" />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-yellow focus:border-transparent text-sm"
                required
              />
              <Mail size={18} className="absolute left-3.5 top-3 text-gray-400" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                Password
              </label>
              <Link to="/reset-password" className="text-xs font-semibold text-amazon-orange hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-yellow focus:border-transparent text-sm"
                required
              />
              <Lock size={18} className="absolute left-3.5 top-3 text-gray-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amazon-orange text-white py-2.5 rounded-md font-bold text-sm shadow hover:bg-opacity-95 active:scale-95 transition flex items-center justify-center space-x-2"
          >
            <LogIn size={18} />
            <span>{loading ? 'Signing In...' : 'Sign In'}</span>
          </button>
        </form>

        {/* Register link */}
        <div className="border-t border-gray-100 mt-6 pt-5 text-center text-sm text-gray-500">
          New to MyShopee?{' '}
          <Link to="/register" className="font-semibold text-amazon-orange hover:underline">
            Create an account
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Login;
