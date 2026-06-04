import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { MapPin, ArrowRight, ShieldCheck, Plus, Check, AlertTriangle, Truck } from 'lucide-react';
import api from '../utils/api';
import { fetchCart } from '../store/cartSlice';

const Checkout = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { items, summary, loading: cartLoading } = useSelector((state) => state.cart);
  const { isAuthenticated } = useSelector((state) => state.auth);

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState('');

  // Coupon States
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;

    setCouponLoading(true);
    setCouponError('');
    setCouponSuccess('');

    // Taxable amount is subtotal after product savings
    const taxableAmount = summary.subtotal - summary.discount;

    try {
      const response = await api.get(`/coupons/validate?code=${encodeURIComponent(couponCodeInput.trim())}&amount=${taxableAmount}`);
      const data = response.data;

      setAppliedCoupon(data.coupon);
      setCouponDiscount(data.discountAmount);
      setCouponSuccess(`Coupon code '${couponCodeInput.trim().toUpperCase()}' applied successfully! Saved $${data.discountAmount.toFixed(2)}.`);
    } catch (err) {
      console.error(err);
      setAppliedCoupon(null);
      setCouponDiscount(0);
      setCouponError(err.response?.data?.error || 'Invalid coupon code.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCodeInput('');
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponSuccess('');
    setCouponError('');
  };

  // 1. Load User Cart and Saved Addresses
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    dispatch(fetchCart());
    loadAddresses();
  }, [isAuthenticated, dispatch, navigate]);

  const loadAddresses = async () => {
    setAddressesLoading(true);
    try {
      const response = await api.get('/addresses');
      setAddresses(response.data);
      
      // Preselect default address, or fallback to first address
      if (response.data.length > 0) {
        const defaultAddr = response.data.find(addr => addr.is_default) || response.data[0];
        setSelectedAddress(defaultAddr);
      }
    } catch (err) {
      console.error('Failed to load addresses:', err);
      setError('Could not retrieve your shipping addresses.');
    } finally {
      setAddressesLoading(false);
    }
  };

  // Mock serviceability rule: Pincodes starting with 99 or equal to 999999 are not serviceable
  const isPincodeServiceable = (pincode) => {
    if (!pincode) return false;
    return pincode !== '999999' && !pincode.startsWith('99');
  };

  const handleSelectAddress = (address) => {
    setSelectedAddress(address);
    setShowAddressModal(false);
    setError('');
  };

  const handleProceedToPayment = async () => {
    if (!selectedAddress) {
      setError('Please select a delivery address to proceed.');
      return;
    }

    if (!isPincodeServiceable(selectedAddress.pincode)) {
      setError('The selected delivery address is not serviceable. Please select or add another address.');
      return;
    }

    setPaymentLoading(true);
    setError('');

    try {
      const response = await api.post('/payment/create-checkout-session', {
        addressId: selectedAddress.id,
        couponCode: appliedCoupon ? appliedCoupon.code : null
      });
      const { url } = response.data;
      
      // Redirect to Stripe checkout / Mock success
      window.location.href = url;
    } catch (err) {
      console.error('Payment checkout error:', err);
      setError(err.response?.data?.error || 'Failed to initiate checkout payment.');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (cartLoading || addressesLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="animate-spin text-amazon-orange" size={40} />
        <p className="text-gray-500 font-semibold text-sm">Preparing checkout details...</p>
      </div>
    );
  }

  // Redirect to cart if empty
  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white border border-gray-100 rounded-lg text-center shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Your Cart is Empty</h2>
        <p className="text-gray-500 mt-2">Add products to your cart before checking out.</p>
        <Link to="/" className="mt-6 inline-block bg-amazon-orange text-white px-6 py-2 rounded font-semibold text-sm">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Title */}
      <h1 className="text-3xl font-black text-gray-900 mb-8 tracking-tight flex items-center gap-2">
        <span>Secure Checkout</span>
        <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full uppercase tracking-wider">
          Step 2 of 2
        </span>
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start space-x-3 text-red-700 text-sm">
          <AlertTriangle className="shrink-0 text-red-500 mt-0.5" size={18} />
          <div>
            <p className="font-bold">Checkout Warning</p>
            <p className="mt-0.5 font-medium">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left: Address Selector and Items Review */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Delivery Address Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <MapPin size={20} className="text-amazon-orange" />
                <span>1. Shipping & Delivery Address</span>
              </h2>
              {addresses.length > 0 && (
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="text-xs font-bold text-amazon-lightBlue hover:underline"
                >
                  Change Address
                </button>
              )}
            </div>

            {addresses.length === 0 ? (
              <div className="py-4 text-center space-y-3">
                <p className="text-sm text-gray-500">No delivery addresses found on your profile.</p>
                <Link
                  to="/profile"
                  state={{ activeTab: 'addresses' }}
                  className="inline-flex items-center space-x-2 bg-amazon-orange text-white px-4 py-2 rounded text-xs font-bold shadow hover:bg-opacity-95"
                >
                  <Plus size={14} />
                  <span>Add Shipping Address</span>
                </Link>
              </div>
            ) : selectedAddress ? (
              <div className="bg-gray-50/50 border border-gray-200 rounded-lg p-5 relative">
                {/* Type Badge */}
                <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                  {selectedAddress.address_type}
                </span>

                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900 text-base">{selectedAddress.full_name}</h3>
                  <p className="text-sm text-gray-700 font-semibold">{selectedAddress.phone}</p>
                  
                  <div className="text-sm text-gray-600 leading-relaxed max-w-md mt-2">
                    <p>{selectedAddress.address_line_1}</p>
                    {selectedAddress.address_line_2 && <p>{selectedAddress.address_line_2}</p>}
                    {selectedAddress.landmark && <p className="text-xs text-gray-400 font-medium">Landmark: {selectedAddress.landmark}</p>}
                    <p>{selectedAddress.city}, {selectedAddress.state}</p>
                    <p className="font-mono font-bold tracking-wide mt-1 text-gray-700">{selectedAddress.pincode}</p>
                  </div>

                  {/* Pincode Serviceability Indicator */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center space-x-2">
                    {isPincodeServiceable(selectedAddress.pincode) ? (
                      <span className="text-xs font-bold text-green-600 flex items-center gap-1.5">
                        <span>✅</span> Pincode {selectedAddress.pincode} is deliverable. Standard Delivery (3-5 days).
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-red-600 flex items-center gap-1.5 bg-red-50 p-2 rounded border border-red-100 w-full">
                        <span>❌</span> Pincode {selectedAddress.pincode} is NOT deliverable. Please choose a serviceable address.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Section 2: Items Review */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <Truck size={20} className="text-amazon-orange" />
              <span>2. Review Items and Shipping Details</span>
            </h2>

            <div className="divide-y divide-gray-100">
              {items.map((item) => {
                const discountedPrice = parseFloat(item.price) * (1 - (item.discount || 0) / 100);
                return (
                  <div key={item.cart_item_id} className="py-4 flex items-start space-x-4">
                    <div className="w-16 h-16 bg-gray-50 border rounded p-1 flex items-center justify-center shrink-0">
                      <img src={item.thumbnail} alt={item.title} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-gray-900 truncate">{item.title}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">Quantity: {item.quantity}</p>
                      <p className="text-xs text-green-600 font-bold mt-1">In Stock</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-amazon-orange text-sm">
                        ${(discountedPrice * item.quantity).toFixed(2)}
                      </span>
                      {item.quantity > 1 && (
                        <p className="text-[10px] text-gray-400 font-medium">
                          ($${discountedPrice.toFixed(2)} each)
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right: Checkout Summary Side Panel */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-6 sticky top-24">
          <h3 className="font-extrabold text-gray-900 text-lg border-b border-gray-100 pb-3">
            Payment Summary
          </h3>

          {/* Coupon Code Input */}
          <div className="border-b border-gray-100 pb-4">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Have a Promo Coupon?</h4>
            {!appliedCoupon ? (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Code (e.g. SUMMER20)"
                  value={couponCodeInput}
                  onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amazon-yellow uppercase font-semibold font-mono"
                />
                <button
                  type="submit"
                  disabled={couponLoading || !couponCodeInput.trim()}
                  className="bg-amazon-blue text-white px-4 py-1.5 rounded font-bold text-xs shadow hover:bg-opacity-95 active:scale-95 disabled:opacity-50 transition"
                >
                  {couponLoading ? 'Validating...' : 'Apply'}
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between bg-green-50 border border-green-150 p-2.5 rounded text-xs">
                <div>
                  <span className="font-extrabold text-green-700 font-mono tracking-wide">{appliedCoupon.code}</span>
                  <span className="text-green-600 block font-medium">Applied! Saved ${couponDiscount.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-red-500 hover:text-red-700 font-bold text-xs ml-3"
                >
                  Remove
                </button>
              </div>
            )}
            
            {couponError && (
              <p className="text-red-600 text-xs font-semibold mt-2.5">
                ⚠️ {couponError}
              </p>
            )}
            {couponSuccess && (
              <p className="text-green-600 text-xs font-semibold mt-2.5">
                ✅ {couponSuccess}
              </p>
            )}
          </div>

          {(() => {
            const taxableAmount = summary.subtotal - summary.discount - couponDiscount;
            const calculatedTax = taxableAmount * 0.08;
            const calculatedTotal = taxableAmount + calculatedTax;
            
            return (
              <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Items Subtotal:</span>
              <span className="font-semibold text-gray-900">${summary.subtotal.toFixed(2)}</span>
            </div>
            
            {summary.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Product Savings:</span>
                <span className="font-semibold">-${summary.discount.toFixed(2)}</span>
              </div>
            )}

            {couponDiscount > 0 && (
              <div className="flex justify-between text-green-600 font-semibold">
                <span>Coupon Discount ({appliedCoupon?.code}):</span>
                <span>-${couponDiscount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>Shipping Fee:</span>
              <span className="font-semibold text-green-600">FREE</span>
            </div>

            <div className="flex justify-between">
              <span>Estimated Tax (8%):</span>
              <span className="font-semibold text-gray-900">${calculatedTax.toFixed(2)}</span>
            </div>

            <div className="border-t border-gray-100 pt-4 flex justify-between text-lg font-black text-gray-900">
              <span>Total Bill:</span>
              <span className="text-amazon-orange">${calculatedTotal.toFixed(2)}</span>
            </div>
          </div>
          );
        })()}

          <button
            onClick={handleProceedToPayment}
            disabled={paymentLoading || !selectedAddress || !isPincodeServiceable(selectedAddress.pincode)}
            className="w-full bg-amazon-orange disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-md font-bold shadow hover:bg-opacity-95 active:scale-95 transition flex items-center justify-center space-x-2"
          >
            <span>{paymentLoading ? 'Connecting to Payment Gate...' : 'Proceed to Payment'}</span>
            {!paymentLoading && <ArrowRight size={18} />}
          </button>

          <div className="flex items-start space-x-2.5 text-xs text-gray-400 bg-gray-50 p-3 rounded border border-gray-100">
            <ShieldCheck size={18} className="text-green-500 shrink-0 mt-0.5" />
            <span>By placing your order, you agree to MyShopee's Privacy Notice and Terms of Service. Secure payments handled via Stripe.</span>
          </div>
        </div>

      </div>

      {/* Address Selector Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-extrabold text-gray-900 text-lg">Change Delivery Address</h3>
              <button
                onClick={() => setShowAddressModal(false)}
                className="text-gray-400 hover:text-gray-600 font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Addresses List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {addresses.map((addr) => {
                const isSelected = selectedAddress?.id === addr.id;
                const serviceable = isPincodeServiceable(addr.pincode);

                return (
                  <div
                    key={addr.id}
                    onClick={() => handleSelectAddress(addr)}
                    className={`p-4 rounded-lg border-2 text-left cursor-pointer transition relative flex gap-3 ${
                      isSelected 
                        ? 'border-amazon-orange bg-amber-50/10' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="mt-1">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-amazon-orange bg-amazon-orange text-white' : 'border-gray-300 bg-white'
                      }`}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">{addr.full_name}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {addr.address_type}
                        </span>
                        {addr.is_default && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-semibold mt-1">{addr.phone}</p>
                      <p className="text-xs text-gray-500 mt-1">{addr.address_line_1}</p>
                      {addr.address_line_2 && <p className="text-xs text-gray-500">{addr.address_line_2}</p>}
                      <p className="text-xs text-gray-500">{addr.city}, {addr.state} - <span className="font-bold">{addr.pincode}</span></p>
                      
                      <div className="mt-2 text-[10px] font-bold">
                        {serviceable ? (
                          <span className="text-green-600">✅ Serviceable</span>
                        ) : (
                          <span className="text-red-600">❌ Not Serviceable</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <Link
                to="/profile"
                state={{ activeTab: 'addresses' }}
                className="text-xs font-bold text-amazon-lightBlue hover:underline flex items-center gap-1"
              >
                <Plus size={14} />
                <span>Add a New Address</span>
              </Link>
              <button
                onClick={() => setShowAddressModal(false)}
                className="bg-gray-250 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded text-xs font-bold"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
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

export default Checkout;
