import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, Link } from 'react-router-dom';
import { User, Mail, ShieldAlert, Award, Save, RefreshCw, MapPin, Plus, Trash2, Edit3, Check, AlertCircle, ShoppingBag, Package } from 'lucide-react';
import api from '../utils/api';
import { syncUser } from '../store/authSlice';

const Profile = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  // General state
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'profile');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

  // Tab 1: Profile Settings Form State
  const [name, setName] = useState(user?.name || '');
  const [profileLoading, setProfileLoading] = useState(false);

  // Tab 2: Addresses List and CRUD State
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  // Address Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [country, setCountry] = useState('India');
  const [pincode, setPincode] = useState('');
  const [addressType, setAddressType] = useState('Home');
  const [isDefault, setIsDefault] = useState(false);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Recently Viewed state
  const [recentlyViewed, setRecentlyViewed] = useState([]);

  useEffect(() => {
    fetchRecentlyViewed();
  }, []);

  const fetchRecentlyViewed = async () => {
    try {
      const res = await api.get('/products/recently-viewed');
      setRecentlyViewed(res.data);
    } catch (err) {
      console.error('Failed to fetch recently viewed:', err);
    }
  };

  // Synchronize Tab from state redirection if any
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  // Load addresses on mount
  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    setAddressesLoading(true);
    try {
      const res = await api.get('/addresses');
      setAddresses(res.data);
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
    } finally {
      setAddressesLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setMessage('');
    setError('');

    try {
      await api.put('/auth/profile', { name });
      await dispatch(syncUser()).unwrap();
      setMessage('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleBecomeAdmin = async () => {
    if (!window.confirm('Do you want to elevate this account to Admin role for testing purposes?')) {
      return;
    }

    setBootstrapLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.post('/auth/make-admin');
      await dispatch(syncUser()).unwrap();
      setMessage(response.data.message || 'Account promoted to Admin successfully!');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Elevation failed.');
    } finally {
      setBootstrapLoading(false);
    }
  };

  const handleBecomeCustomer = async () => {
    if (!window.confirm('Do you want to switch back to Customer role?')) {
      return;
    }

    setBootstrapLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.post('/auth/make-customer');
      await dispatch(syncUser()).unwrap();
      setMessage(response.data.message || 'Account switched to Customer successfully!');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Role switch failed.');
    } finally {
      setBootstrapLoading(false);
    }
  };

  // Addresses Handlers
  const handleSetDefault = async (id) => {
    try {
      await api.put(`/addresses/${id}/set-default`);
      fetchAddresses();
      setMessage('Default address updated successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to set default address.');
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    try {
      await api.delete(`/addresses/${id}`);
      fetchAddresses();
      setMessage('Address deleted successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete address.');
    }
  };

  const openAddForm = () => {
    setEditingAddress(null);
    setFullName('');
    setPhone('');
    setAddressLine1('');
    setAddressLine2('');
    setLandmark('');
    setCity('');
    setAddressState('');
    setCountry('India');
    setPincode('');
    setAddressType('Home');
    setIsDefault(addresses.length === 0); // make default if it is the first address
    setFormError('');
    setShowAddressForm(true);
  };

  const openEditForm = (addr) => {
    setEditingAddress(addr);
    setFullName(addr.full_name);
    setPhone(addr.phone);
    setAddressLine1(addr.address_line_1);
    setAddressLine2(addr.address_line_2 || '');
    setLandmark(addr.landmark || '');
    setCity(addr.city);
    setAddressState(addr.state);
    setCountry(addr.country || 'India');
    setPincode(addr.pincode);
    setAddressType(addr.address_type);
    setIsDefault(addr.is_default);
    setFormError('');
    setShowAddressForm(true);
  };

  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Phone & Pincode Regex Verification
    if (!/^\d{10}$/.test(phone)) {
      setFormError('Mobile number must be exactly 10 digits.');
      return;
    }
    if (!/^\d{6}$/.test(pincode)) {
      setFormError('Pincode must be exactly 6 digits.');
      return;
    }

    setFormLoading(true);
    const payload = {
      full_name: fullName,
      phone,
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      landmark,
      city,
      state: addressState,
      country,
      pincode,
      address_type: addressType,
      is_default: isDefault
    };

    try {
      if (editingAddress) {
        await api.put(`/addresses/${editingAddress.id}`, payload);
      } else {
        await api.post('/addresses', payload);
      }
      setShowAddressForm(false);
      fetchAddresses();
      setMessage(editingAddress ? 'Address updated successfully!' : 'Address added successfully!');
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.error || 'Failed to save address.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      
      {/* Profile Header Banner */}
      <div className="bg-amazon-blue rounded-t-xl p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-amazon-orange text-white flex items-center justify-center font-extrabold text-2xl uppercase border-2 border-white shadow">
            {user?.name?.slice(0, 2)}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user?.name}</h2>
            <p className="text-xs text-gray-300 font-medium">Manage display info, address lists, and settings</p>
          </div>
        </div>
        <div>
          <span className={`text-xs font-bold uppercase py-1.5 px-4 rounded-full border ${
            user?.role === 'admin' 
              ? 'bg-yellow-500/10 border-yellow-500 text-amazon-yellow' 
              : 'bg-green-500/10 border-green-500 text-green-500'
          }`}>
            Role: {user?.role}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-200 overflow-hidden">
        
        {/* Alerts and Messages */}
        {message && (
          <div className="m-6 mb-2 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm font-semibold flex items-center space-x-2">
            <span>✅</span>
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="m-6 mb-2 bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm font-semibold flex items-center space-x-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Tab Headers */}
        <div className="border-b border-gray-200 bg-gray-50 flex flex-wrap">
          <button
            onClick={() => { setActiveTab('profile'); setMessage(''); setError(''); }}
            className={`px-6 py-4.5 text-sm font-bold border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'profile'
                ? 'border-amazon-orange text-amazon-orange bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <User size={16} />
            <span>My Profile</span>
          </button>
          <button
            onClick={() => { setActiveTab('addresses'); setMessage(''); setError(''); }}
            className={`px-6 py-4.5 text-sm font-bold border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'addresses'
                ? 'border-amazon-orange text-amazon-orange bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <MapPin size={16} />
            <span>Delivery Addresses</span>
            {addresses.length === 0 && !addressesLoading && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            )}
          </button>
          <Link
            to="/orders"
            className="px-6 py-4.5 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 flex items-center space-x-2 transition"
          >
            <ShoppingBag size={16} />
            <span>My Orders</span>
          </Link>
        </div>

        {/* Content Box */}
        <div className="p-8">
          {activeTab === 'profile' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Profile Details Form */}
              <div className="md:col-span-2 space-y-6">
                <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
                  Profile Metadata
                </h3>

                <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Display Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-yellow text-sm font-medium"
                        required
                      />
                      <User size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative opacity-70">
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500 text-sm cursor-not-allowed font-medium"
                      />
                      <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-1">
                      Contact email synchronized with Firebase auth credentials.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="bg-amazon-orange text-white px-5 py-2.5 rounded-md font-bold text-sm shadow hover:bg-opacity-95 flex items-center space-x-1.5 transition active:scale-95"
                  >
                    <Save size={16} />
                    <span>{profileLoading ? 'Saving Changes...' : 'Save Settings'}</span>
                  </button>
                </form>
              </div>

              {/* Sidebar Info & Dev Tools Column */}
              <div className="md:col-span-1 border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-6 space-y-6">
                {/* My Orders Summary Card */}
                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 text-center flex flex-col items-center">
                  <ShoppingBag className="text-amazon-blue mb-3" size={32} />
                  <h4 className="font-extrabold text-gray-900 text-sm">Purchase History</h4>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed font-medium">
                    Monitor package shipments, inspect invoice records, or track current order timelines.
                  </p>
                  <Link
                    to="/orders"
                    className="mt-4 w-full bg-amazon-orange hover:bg-opacity-95 text-white py-2 rounded-md font-bold text-xs shadow flex items-center justify-center space-x-1.5 transition active:scale-95 text-center"
                  >
                    <Package size={14} />
                    <span>View & Track Orders</span>
                  </Link>
                </div>

                {/* Dev Elevate Box */}
                {user?.email === 'unmeshbhangale41@gmail.com' && (
                  <div className="bg-amber-50 rounded-lg p-5 border border-amber-100 text-center flex flex-col items-center">
                    <ShieldAlert className="text-amber-600 mb-3" size={32} />
                    <h4 className="font-bold text-amber-800 text-sm">Developer Tools</h4>
                    <p className="text-xs text-amber-700 mt-2 leading-relaxed">
                      Switch roles to preview the platform layout as a customer or administrator.
                    </p>

                    {user?.role === 'admin' ? (
                      <button
                        onClick={handleBecomeCustomer}
                        disabled={bootstrapLoading}
                        className="mt-4 w-full bg-gray-600 hover:bg-opacity-95 text-white py-2 rounded font-bold text-xs shadow flex items-center justify-center space-x-1.5"
                      >
                        {bootstrapLoading ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <span>Switch to Customer</span>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={handleBecomeAdmin}
                        disabled={bootstrapLoading}
                        className="mt-4 w-full bg-amazon-lightBlue hover:bg-opacity-95 text-white py-2 rounded font-bold text-xs shadow flex items-center justify-center space-x-1.5"
                      >
                        {bootstrapLoading ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <span>Become Administrator</span>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            
            // DELIVERY ADDRESSES TAB
            <div className="space-y-6">
              
              {/* 1. Address Completeness Alert Banner */}
              {addresses.length === 0 && !addressesLoading && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-start space-x-3 text-sm">
                  <AlertCircle className="shrink-0 text-amber-600 mt-0.5" size={18} />
                  <div>
                    <span className="font-bold">⚠️ Complete your delivery details to place orders.</span>
                    <p className="text-xs text-amber-700 mt-0.5">We require at least one registered shipping destination before you can check out cart products.</p>
                  </div>
                </div>
              )}

              {/* 2. Headline & Add Button */}
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Your Saved Addresses</h3>
                  <p className="text-xs text-gray-400">Add, delete, or prioritize destinations for checkout</p>
                </div>
                <button
                  onClick={openAddForm}
                  className="bg-amazon-orange text-white px-4 py-2 rounded-md font-bold text-xs shadow hover:bg-opacity-95 transition flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Add New Address</span>
                </button>
              </div>

              {/* 3. Address Grid List */}
              {addressesLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="animate-spin text-amazon-orange mx-auto" size={32} />
                  <p className="text-xs text-gray-400 mt-2 font-medium">Retrieving addresses...</p>
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl max-w-lg mx-auto flex flex-col items-center">
                  <MapPin size={48} className="text-gray-300 mb-3" />
                  <p className="text-gray-500 font-bold text-sm">No Addresses Registered</p>
                  <p className="text-xs text-gray-400 max-w-xs mt-1">Press the "Add New Address" button to register your standard shipping destination.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {addresses.map((addr) => (
                    <div 
                      key={addr.id} 
                      className={`relative bg-white rounded-lg p-5 border-2 transition-all duration-200 flex flex-col justify-between ${
                        addr.is_default 
                          ? 'border-amazon-orange shadow-sm bg-amber-50/5' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        {/* Headers: Type badge and Default badge */}
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-600 tracking-wider">
                            {addr.address_type}
                          </span>
                          {addr.is_default && (
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 tracking-wider flex items-center gap-0.5">
                              <Check size={10} strokeWidth={3} /> Default
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <h4 className="font-extrabold text-gray-900 text-sm">{addr.full_name}</h4>
                        <p className="text-xs text-gray-700 font-bold mt-1">{addr.phone}</p>
                        
                        <div className="text-xs text-gray-500 space-y-0.5 mt-2 leading-relaxed">
                          <p>{addr.address_line_1}</p>
                          {addr.address_line_2 && <p>{addr.address_line_2}</p>}
                          {addr.landmark && <p className="text-[10px] text-gray-400">Landmark: {addr.landmark}</p>}
                          <p>{addr.city}, {addr.state}</p>
                          <p className="font-bold text-gray-700 tracking-wide font-mono mt-1">{addr.pincode}</p>
                        </div>
                      </div>

                      {/* Card Operations */}
                      <div className="border-t border-gray-100 pt-4 mt-5 flex items-center justify-between gap-2">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => openEditForm(addr)}
                            className="p-1.5 text-gray-400 hover:text-amazon-orange rounded hover:bg-gray-50 transition"
                            title="Edit Address"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition"
                            title="Delete Address"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        
                        {!addr.is_default && (
                          <button
                            onClick={() => handleSetDefault(addr.id)}
                            className="text-[10px] font-black text-amazon-lightBlue hover:underline"
                          >
                            Set as Default
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}
        </div>

      </div>

      {/* Address Form Drawer/Overlay Modal */}
      {showAddressForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-extrabold text-gray-900 text-lg">
                {editingAddress ? 'Update Delivery Address' : 'Register New Address'}
              </h3>
              <button onClick={() => setShowAddressForm(false)} className="text-gray-400 hover:text-gray-600 font-extrabold text-sm">
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddressSubmit} className="flex-grow overflow-y-auto p-6 space-y-4">
              
              {formError && (
                <div className="bg-red-50 border border-red-150 rounded-lg p-3 text-red-600 text-xs font-semibold flex items-center space-x-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Row 1: Full name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amazon-yellow outline-none font-medium"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Mobile Number (10 Digits) *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amazon-yellow outline-none font-medium"
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>

              {/* Row 2: Address Line 1 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Address Line 1 *</label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amazon-yellow outline-none font-medium"
                  placeholder="Flat, House no., Building, Company, Apartment"
                />
              </div>

              {/* Row 3: Address Line 2 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Address Line 2 (Optional)</label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amazon-yellow outline-none font-medium"
                  placeholder="Area, Street, Sector, Village"
                />
              </div>

              {/* Row 4: Landmark */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Landmark (Optional)</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amazon-yellow outline-none font-medium"
                  placeholder="e.g. near Apollo Hospital"
                />
              </div>

              {/* Row 5: City & State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amazon-yellow outline-none font-medium"
                    placeholder="e.g. Mumbai"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">State *</label>
                  <input
                    type="text"
                    value={addressState}
                    onChange={(e) => setAddressState(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amazon-yellow outline-none font-medium"
                    placeholder="e.g. Maharashtra"
                  />
                </div>
              </div>

              {/* Row 6: Country & Pincode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Country *</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amazon-yellow outline-none font-medium"
                    placeholder="e.g. India"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Pincode (6 Digits) *</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amazon-yellow outline-none font-medium font-mono"
                    placeholder="e.g. 400058"
                  />
                </div>
              </div>

              {/* Row 7: Address Type */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Address Type</label>
                <div className="flex space-x-3">
                  {['Home', 'Work', 'Other'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAddressType(type)}
                      className={`flex-1 py-2 text-xs font-bold rounded border transition ${
                        addressType === type
                          ? 'bg-amazon-orange text-white border-amazon-orange'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 8: Default Checkbox */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded text-amazon-orange focus:ring-amazon-orange w-4 h-4"
                />
                <label htmlFor="isDefault" className="text-xs font-bold text-gray-700 select-none">
                  Make this my default shipping address
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="border-t border-gray-150 pt-4 mt-6 flex justify-end space-x-3 bg-white">
                <button
                  type="button"
                  onClick={() => setShowAddressForm(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-amazon-orange text-white px-5 py-2.5 rounded font-bold text-xs shadow hover:bg-opacity-95 transition flex items-center space-x-1"
                >
                  {formLoading && <Loader2 size={12} className="animate-spin" />}
                  <span>{formLoading ? 'Saving...' : editingAddress ? 'Update Details' : 'Save Address'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Recently Viewed Carousel */}
      {recentlyViewed.length > 0 && (
        <div className="mt-12 bg-white p-6 rounded-xl border border-gray-205 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 mb-6">
            You Recently Viewed
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {recentlyViewed.slice(0, 6).map((prod) => {
              const discPrice = parseFloat(prod.price) * (1 - (prod.discount || 0) / 100);
              const imagesList = Array.isArray(prod.images) ? prod.images : [];
              const primaryImage = imagesList.find(img => img.is_primary === true) || imagesList[0];
              const thumbnail = primaryImage
                ? (typeof primaryImage === 'string' ? primaryImage : primaryImage.image_url)
                : 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=100';
              return (
                <Link
                  key={prod.id}
                  to={`/product/${prod.id}`}
                  className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:shadow-md hover:border-amazon-orange transition group"
                >
                  <div className="w-full aspect-square bg-gray-50 flex items-center justify-center p-1.5 rounded mb-2 overflow-hidden">
                    <img
                      src={thumbnail}
                      alt={prod.title}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <h4 className="font-bold text-xs text-gray-800 line-clamp-1 w-full text-center group-hover:text-amazon-orange transition-colors">
                    {prod.title}
                  </h4>
                  <span className="font-black text-amazon-orange text-xs mt-1">
                    ${discPrice.toFixed(2)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
// Loader wrapper
function Loader2({ size, className }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default Profile;
