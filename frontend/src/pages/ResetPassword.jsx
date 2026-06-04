import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { auth, sendPasswordResetEmail } from '../firebase/config';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
      setEmail('');
    } catch (err) {
      console.error('Password reset error:', err);
      let errMsg = 'Failed to send password reset email.';
      if (err.code === 'auth/user-not-found') {
        errMsg = 'No account found with this email address.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Invalid email address format.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
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
          <h2 className="text-xl font-bold text-gray-800 mt-3">Reset Your Password</h2>
          <p className="text-sm text-gray-400 mt-1">We will send a password reset link to your email address.</p>
        </div>

        {/* Success message */}
        {success && (
          <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-green-700 text-sm font-semibold flex flex-col items-center text-center space-y-2 mb-6">
            <CheckCircle2 size={24} className="text-green-500 shrink-0" />
            <span>Success! Reset link has been sent.</span>
            <p className="font-normal text-xs text-green-600">Please check your inbox and spam folders for instructions.</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-red-600 text-sm font-semibold flex items-center space-x-2 mb-6">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        {!success && (
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amazon-orange text-white py-2.5 rounded-md font-bold text-sm shadow hover:bg-opacity-95 active:scale-95 transition"
            >
              {loading ? 'Sending Link...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        {/* Back to Login link */}
        <div className="border-t border-gray-100 mt-6 pt-5 text-center">
          <Link to="/login" className="inline-flex items-center space-x-2 text-sm font-semibold text-amazon-blue hover:underline">
            <ArrowLeft size={16} />
            <span>Back to Sign In</span>
          </Link>
        </div>

      </div>
    </div>
  );
};

export default ResetPassword;
