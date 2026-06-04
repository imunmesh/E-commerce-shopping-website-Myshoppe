import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Trash2, ShoppingBag, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { fetchCart, updateCartItem, removeFromCart } from '../store/cartSlice';
import api from '../utils/api';

const Cart = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, summary, loading } = useSelector((state) => state.cart);
  const { isAuthenticated } = useSelector((state) => state.auth);
  
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCart());
    }
  }, [isAuthenticated, dispatch]);

  const handleQtyChange = (itemId, currentQty, stock, increment) => {
    const newQty = increment ? currentQty + 1 : currentQty - 1;
    if (newQty <= 0) return;
    if (newQty > stock) {
      alert(`Only ${stock} items available in stock.`);
      return;
    }
    dispatch(updateCartItem({ itemId, quantity: newQty }));
  };

  const handleRemove = (itemId) => {
    if (window.confirm('Remove this product from your shopping cart?')) {
      dispatch(removeFromCart(itemId));
    }
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      // 1. Fetch addresses to check if any exist
      const response = await api.get('/addresses');
      const addresses = response.data;
      
      if (addresses.length === 0) {
        setShowAddressModal(true);
      } else {
        // 2. Navigate to Checkout Page if address exists
        navigate('/checkout');
      }
    } catch (error) {
      console.error('Checkout check error:', error);
      alert(error.response?.data?.error || 'Failed to check shipping details.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 max-w-md mx-auto flex flex-col items-center">
          <ShoppingBag size={48} className="text-gray-400 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-gray-900">Your Cart is Empty</h2>
          <p className="text-gray-500 mt-2">Sign in to sync your shopping cart and browse products.</p>
          <Link to="/login" className="mt-6 w-full bg-amazon-orange text-white py-2.5 rounded-md font-semibold text-sm shadow hover:bg-opacity-95 text-center">
            Sign In to Your Account
          </Link>
        </div>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse space-y-4">
        <div className="bg-gray-200 h-8 rounded w-1/4"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-gray-200 h-96 rounded-lg"></div>
          <div className="bg-gray-200 h-64 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-black text-gray-900 mb-8 tracking-tight">Shopping Cart</h1>

      {items.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-100 text-center shadow-sm flex flex-col items-center">
          <ShoppingBag size={64} className="text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Your Cart is Empty</h2>
          <p className="text-gray-500 mt-2">Explore thousands of premium products on MyShopee and add them to your cart.</p>
          <Link to="/" className="mt-6 bg-amazon-orange text-white px-6 py-2.5 rounded-md font-semibold text-sm shadow hover:bg-opacity-95">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const originalPrice = parseFloat(item.price);
              const discountPct = parseFloat(item.discount || 0);
              const hasDiscount = discountPct > 0;
              const discountedPrice = hasDiscount 
                ? originalPrice * (1 - discountPct / 100) 
                : originalPrice;

              return (
                <div key={item.cart_item_id} className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-5 relative group">
                  
                  {/* Thumbnail */}
                  <Link to={`/product/${item.product_id}`} className="w-24 h-24 bg-gray-50 rounded border border-gray-100 p-2 flex items-center justify-center shrink-0">
                    <img
                      src={item.thumbnail || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80'}
                      alt={item.title}
                      className="max-h-full max-w-full object-contain"
                    />
                  </Link>

                  {/* Title & Price */}
                  <div className="flex-1 text-center sm:text-left">
                    <Link to={`/product/${item.product_id}`} className="font-bold text-gray-900 hover:text-amazon-orange text-sm line-clamp-2">
                      {item.title}
                    </Link>
                    <p className="text-xs text-gray-400 mt-1">Brand: {item.brand || 'Generic'}</p>
                    
                    <div className="flex items-center justify-center sm:justify-start space-x-2 mt-2">
                      <span className="font-extrabold text-amazon-orange text-base">${discountedPrice.toFixed(2)}</span>
                      {hasDiscount && (
                        <span className="text-xs text-gray-400 line-through">${originalPrice.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Actions */}
                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="flex items-center border border-gray-200 rounded">
                      <button
                        onClick={() => handleQtyChange(item.cart_item_id, item.quantity, item.stock, false)}
                        className="px-2.5 py-1 bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold"
                      >
                        -
                      </button>
                      <span className="px-3 text-sm font-bold text-gray-800">{item.quantity}</span>
                      <button
                        onClick={() => handleQtyChange(item.cart_item_id, item.quantity, item.stock, true)}
                        className="px-2.5 py-1 bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemove(item.cart_item_id)}
                      className="p-2 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition"
                      title="Remove product"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Cart Summary Card */}
          <div className="lg:col-span-1 bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-6 sticky top-24">
            <h3 className="font-bold text-gray-900 text-lg border-b border-gray-100 pb-3">
              Order Summary
            </h3>

            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-gray-900">${summary.subtotal.toFixed(2)}</span>
              </div>
              
              {summary.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Product Savings:</span>
                  <span className="font-semibold">-${summary.discount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Estimated Tax (8%):</span>
                <span className="font-semibold text-gray-900">${summary.tax.toFixed(2)}</span>
              </div>

              <div className="border-t border-gray-100 pt-4 flex justify-between text-lg font-black text-gray-900">
                <span>Total Amount:</span>
                <span className="text-amazon-orange">${summary.total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full bg-amazon-orange text-white py-3 rounded-md font-bold shadow hover:bg-opacity-95 active:scale-95 transition flex items-center justify-center space-x-2"
            >
              <span>{checkoutLoading ? 'Redirecting to Checkout...' : 'Proceed to Checkout'}</span>
              {!checkoutLoading && <ArrowRight size={18} />}
            </button>

            <div className="flex items-center justify-center space-x-2 text-xs text-gray-400 text-center bg-gray-50 p-2.5 rounded border border-gray-100">
              <ShieldCheck size={16} className="text-green-500" />
              <span>Stripe Secured Transactions. SSL Encrypted.</span>
            </div>

          </div>

        </div>
      )}

      {/* Address Warning Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-2xl w-full max-w-md text-center space-y-6">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center border border-red-100">
                <AlertTriangle size={24} />
              </div>
              <h3 className="font-extrabold text-gray-900 text-lg mt-4">Address Required</h3>
              <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                Please add a delivery address before proceeding to checkout.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAddressModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm py-2.5 rounded transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowAddressModal(false);
                  navigate('/profile', { state: { activeTab: 'addresses' } });
                }}
                className="flex-1 bg-amazon-orange text-white font-bold text-sm py-2.5 rounded shadow hover:bg-opacity-95 transition"
              >
                Add Address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
