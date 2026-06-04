import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Mail, Lock, User, UserPlus, AlertCircle } from 'lucide-react';
import { auth, createUserWithEmailAndPassword, updateProfile } from '../firebase/config';
import { syncUser, setAuthError, setAuthLoading } from '../store/authSlice';

const Register = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    dispatch(setAuthLoading(true));

    try {
      // 1. Create account on Firebase
      await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Set profile displayName
      await updateProfile(auth.currentUser, { displayName: name });
      
      // 3. Synchronize in local database
      await dispatch(syncUser()).unwrap();

      // 4. Success -> Redirect
      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      let errMsg = 'Failed to register account.';
      if (err.code === 'auth/email-already-in-use') {
        errMsg = 'An account with this email already exists.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Invalid email address format.';
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
          <h2 className="text-xl font-bold text-gray-800 mt-3">Create Your Account</h2>
          <p className="text-sm text-gray-400 mt-1">Join MyShopee today and start your e-commerce journey.</p>
        </div>

        {/* Error message */}
        {(localError || error) && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-red-600 text-sm font-semibold flex items-center space-x-2 mb-6">
            <AlertCircle size={18} className="shrink-0" />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-yellow focus:border-transparent text-sm"
                required
              />
              <User size={18} className="absolute left-3.5 top-3 text-gray-400" />
            </div>
          </div>

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
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-yellow focus:border-transparent text-sm"
                required
              />
              <Lock size={18} className="absolute left-3.5 top-3 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-yellow focus:border-transparent text-sm"
                required
              />
              <Lock size={18} className="absolute left-3.5 top-3 text-gray-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amazon-orange text-white py-2.5 rounded-md font-bold text-sm shadow hover:bg-opacity-95 active:scale-95 transition flex items-center justify-center space-x-2 pt-2.5"
          >
            <UserPlus size={18} />
            <span>{loading ? 'Creating Account...' : 'Register'}</span>
          </button>
        </form>

        {/* Login link */}
        <div className="border-t border-gray-100 mt-6 pt-5 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-amazon-orange hover:underline">
            Sign In
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Register;
