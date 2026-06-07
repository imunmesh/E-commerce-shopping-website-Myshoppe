import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ShoppingCart, Heart, Search, User, LogOut, Shield, Scale, Bell } from 'lucide-react';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { clearAuthState } from '../store/authSlice';
import api from '../utils/api';

const Navbar = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const cartItems = useSelector((state) => state.cart.items);
  const wishlistItems = useSelector((state) => state.wishlist.items);
  const compareItems = useSelector((state) => state.compare.items);

  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const wishlistCount = wishlistItems.length;
  const compareCount = compareItems.length;
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      // Poll notifications every 8 seconds for live demo updates
      const interval = setInterval(fetchNotifications, 8000);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
    }
  }, [isAuthenticated]);

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      dispatch(clearAuthState());
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="sticky top-0 z-50 dark-glassmorphism text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 space-x-4">
          
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 shrink-0">
            <span className="text-2xl font-black tracking-tight text-white font-sans">
              My<span className="text-amazon-yellow">Shopee</span>
            </span>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-lg relative hidden sm:block">
            <input
              type="text"
              placeholder="Search products, brands, categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-gray-900 pl-4 pr-10 py-2 rounded-md border border-transparent focus:outline-none focus:ring-2 focus:ring-amazon-yellow transition duration-150"
            />
            <button type="submit" className="absolute right-0 top-0 bottom-0 px-3 bg-amazon-yellow hover:bg-opacity-90 rounded-r-md text-amazon-blue flex items-center justify-center transition duration-150">
              <Search size={18} />
            </button>
          </form>

          {/* Nav Items */}
          <div className="flex items-center space-x-5 shrink-0">
            
            {/* Compare */}
            {isAuthenticated && (
              <Link to="/compare" className="relative p-1 hover:text-amazon-yellow transition-colors duration-150 flex items-center space-x-1">
                <Scale size={22} />
                {compareCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-amazon-orange text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-amazon-blue">
                    {compareCount}
                  </span>
                )}
                <span className="hidden md:inline text-sm font-medium">Compare</span>
              </Link>
            )}

            {/* Wishlist */}
            <Link to="/wishlist" className="relative p-1 hover:text-amazon-yellow transition-colors duration-150 flex items-center space-x-1">
              <Heart size={22} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-amazon-orange text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-amazon-blue">
                  {wishlistCount}
                </span>
              )}
              <span className="hidden md:inline text-sm font-medium">Wishlist</span>
            </Link>

            {/* Cart */}
            <Link to="/cart" className="relative p-1 hover:text-amazon-yellow transition-colors duration-150 flex items-center space-x-1">
              <ShoppingCart size={22} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-amazon-orange text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-amazon-blue">
                  {cartCount}
                </span>
              )}
              <span className="hidden md:inline text-sm font-medium">Cart</span>
            </Link>

            {/* Admin Dashboard Shield */}
            {user?.role === 'admin' && (
              <Link to="/admin" className="p-1 hover:text-amazon-yellow transition-colors duration-150 flex items-center space-x-1 text-amazon-yellow">
                <Shield size={20} />
                <span className="hidden md:inline text-sm font-semibold">Admin</span>
              </Link>
            )}

            {/* Notifications Bell */}
            {isAuthenticated && (
              <div 
                className="relative"
                onMouseLeave={() => setShowNotifications(false)}
              >
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-1 hover:text-amazon-yellow transition-colors duration-150 flex items-center space-x-1"
                >
                  <Bell size={22} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 bg-amazon-orange text-white text-[9px] font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center border-2 border-amazon-blue">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 text-gray-800 py-2 z-50 animate-fadeIn">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-150">
                      <span className="font-bold text-sm text-gray-900">Notifications ({unreadCount})</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-xs font-semibold text-amazon-lightBlue hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-gray-400">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              handleMarkAsRead(n.id);
                              setShowNotifications(false);
                              navigate('/orders');
                            }}
                            className={`px-4 py-3 hover:bg-gray-50 cursor-pointer flex gap-3 transition-colors ${
                              !n.is_read ? 'bg-blue-50/30' : ''
                            }`}
                          >
                            <div className="text-xl shrink-0 mt-0.5">
                              {n.title.split(' ')[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">
                                {n.title.substring(n.title.indexOf(' ') + 1)}
                              </p>
                              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                                {n.message}
                              </p>
                              <p className="text-[9px] text-gray-400 mt-1 font-medium">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            {!n.is_read && (
                              <div className="h-2 w-2 rounded-full bg-amazon-orange shrink-0 mt-2"></div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Profile / Login */}
            {isAuthenticated ? (
              <div className="flex items-center space-x-4 border-l border-gray-700 pl-4">
                <Link to="/profile" className="flex items-center space-x-1 hover:text-amazon-yellow transition-colors duration-150">
                  <User size={20} />
                  <span className="hidden lg:inline text-sm max-w-[100px] truncate font-medium">
                    {user?.name}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-1 hover:text-red-400 transition-colors duration-150 flex items-center space-x-1"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-amazon-yellow hover:bg-opacity-90 text-amazon-blue px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-150 hover:shadow-lg"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="pb-3 sm:hidden">
          <form onSubmit={handleSearch} className="relative w-full">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-gray-900 pl-4 pr-10 py-2 rounded-md border border-transparent focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
            />
            <button type="submit" className="absolute right-0 top-0 bottom-0 px-3 bg-amazon-yellow text-amazon-blue rounded-r-md flex items-center justify-center">
              <Search size={18} />
            </button>
          </form>
        </div>

      </div>
    </header>
  );
};

export default Navbar;
