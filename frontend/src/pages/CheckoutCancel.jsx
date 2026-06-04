import React from 'react';
import { Link } from 'react-router-dom';
import { XCircle, ShoppingCart, Home } from 'lucide-react';

const CheckoutCancel = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 w-full max-w-md text-center space-y-6">
        
        {/* Header */}
        <div className="flex flex-col items-center">
          <XCircle size={64} className="text-red-500 animate-pulse" />
          <h1 className="text-3xl font-black text-gray-900 mt-4 tracking-tight">Payment Cancelled</h1>
          <p className="text-sm text-gray-400 mt-2">
            Your transaction was not processed. No charges have been made.
          </p>
        </div>

        {/* Details block */}
        <div className="bg-red-50/50 p-4 rounded-lg text-xs text-red-700 border border-red-100/50 text-center font-medium leading-relaxed">
          If you closed the Stripe page manually, you can try paying again. If your credit card was rejected, please check with your financial institution or try a different payment card.
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Link
            to="/cart"
            className="flex-1 bg-amazon-orange text-white py-2.5 rounded-md font-bold text-sm shadow hover:bg-opacity-95 flex items-center justify-center space-x-2 transition"
          >
            <ShoppingCart size={16} />
            <span>Go Back to Cart</span>
          </Link>
          
          <Link
            to="/"
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-md font-bold text-sm flex items-center justify-center space-x-2 transition"
          >
            <Home size={16} />
            <span>Return Home</span>
          </Link>
        </div>

      </div>
    </div>
  );
};

export default CheckoutCancel;
