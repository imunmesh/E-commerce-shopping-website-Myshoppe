import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { CheckCircle2, ShoppingBag, ArrowRight } from 'lucide-react';
import api from '../utils/api';
import { fetchCart } from '../store/cartSlice';

const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();

  const sessionId = searchParams.get('session_id') || '';
  const isMock = searchParams.get('mock') === 'true';
  const items = searchParams.get('items') || '';
  const amount = searchParams.get('amount') || '';
  const addressId = searchParams.get('address_id') || '';
  const couponCode = searchParams.get('coupon_code') || '';
  const discountAmount = searchParams.get('discount_amount') || '';

  const [processing, setProcessing] = useState(!!sessionId);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');
  const hasCalled = useRef(false);

  useEffect(() => {
    if (isMock) {
      if (sessionId && items && amount && addressId) {
        if (hasCalled.current) return;
        hasCalled.current = true;
        triggerMockWebhook();
      } else {
        setError('Missing mock checkout parameters.');
        setProcessing(false);
      }
    } else if (sessionId) {
      if (hasCalled.current) return;
      hasCalled.current = true;
      confirmRealPayment();
    } else {
      setProcessing(false);
    }
  }, [isMock, sessionId, items, amount, addressId]);

  const confirmRealPayment = async () => {
    setProcessing(true);
    try {
      const response = await api.post('/payment/confirm-payment', {
        sessionId
      });
      setOrderId(response.data.orderId);
      // Refresh cart in Redux store (as it was cleared after successful order creation)
      dispatch(fetchCart());
    } catch (err) {
      console.error('Failed to confirm payment:', err);
      setError(err.response?.data?.error || 'Failed to verify payment status. Please contact support.');
    } finally {
      setProcessing(false);
    }
  };

  const triggerMockWebhook = async () => {
    setProcessing(true);
    try {
      const response = await api.post('/payment/mock-webhook', {
        sessionId,
        items,
        amount,
        addressId,
        couponCode: couponCode || null,
        discountAmount: discountAmount ? parseFloat(discountAmount) : 0
      });
      setOrderId(response.data.orderId);
      // Refresh cart in Redux store (as it was cleared by webhook)
      dispatch(fetchCart());
    } catch (err) {
      console.error('Failed to process mock webhook:', err);
      setError(err.response?.data?.error || 'Simulated checkout processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 w-full max-w-lg text-center space-y-6">
        
        {processing ? (
          <div className="flex flex-col items-center py-6 space-y-4">
            <Loader2 className="animate-spin text-amazon-orange" size={48} />
            <h2 className="text-xl font-bold text-gray-800">Processing Payment Confirmation...</h2>
            <p className="text-sm text-gray-400 max-w-sm">
              We are verifying your transaction signature, creating your order invoice, and updating store inventory levels. Please do not close this window.
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-6 space-y-4">
            <span className="text-5xl">⚠️</span>
            <h2 className="text-xl font-bold text-red-600">Simulated Verification Failure</h2>
            <p className="text-sm text-gray-500 max-w-sm">{error}</p>
            <Link to="/cart" className="bg-amazon-blue text-white px-6 py-2.5 rounded font-semibold text-sm hover:bg-opacity-95">
              Return to Cart
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Visual Header */}
            <div className="flex flex-col items-center">
              <CheckCircle2 size={64} className="text-green-500 animate-bounce" />
              <h1 className="text-3xl font-black text-gray-900 mt-4 tracking-tight">Payment Successful!</h1>
              <p className="text-sm text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full mt-2 border border-green-200">
                Order Status: Paid & Confirmed
              </p>
            </div>

            {/* Content Details */}
            <div className="bg-gray-50 p-5 rounded-lg text-left border border-gray-100 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Stripe Session ID:</span>
                <span className="font-bold text-gray-800 font-mono text-xs max-w-[200px] truncate">{sessionId}</span>
              </div>
              {orderId && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Order Number:</span>
                  <span className="font-bold text-amazon-orange font-mono">#{orderId}</span>
                </div>
              )}
              {amount && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Total Paid:</span>
                  <span className="font-bold text-gray-900">${parseFloat(amount).toFixed(2)}</span>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2 text-center border-t border-gray-200 pt-2.5">
                A confirmation email containing receipt details and shipment estimates has been sent to your account via Brevo.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link
                to="/orders"
                className="flex-1 bg-amazon-orange text-white py-3 rounded-md font-bold text-sm shadow hover:bg-opacity-95 flex items-center justify-center space-x-2 transition"
              >
                <span>Track Your Orders</span>
                <ArrowRight size={16} />
              </Link>
              
              <Link
                to="/"
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-md font-bold text-sm flex items-center justify-center space-x-2 transition"
              >
                <ShoppingBag size={16} />
                <span>Continue Shopping</span>
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// Simple loader wrapper
function Loader2({ size, className }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default CheckoutSuccess;
