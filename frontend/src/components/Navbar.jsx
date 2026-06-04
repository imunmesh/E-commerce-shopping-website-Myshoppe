import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ShoppingCart, Heart, Search, User, LogOut, Shield, Scale } from 'lucide-react';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { clearAuthState } from '../store/authSlice';

const Navbar = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const cartItems = useSelector((state) => state.cart.items);
  const wishlistItems = useSelector((state) => state.wishlist.items);
  const compareItems = useSelector((state) => state.compare.items);

  const [searchQuery, setSearchQuery] = useState('');

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const wishlistCount = wishlistItems.length;
  const compareCount = compareItems.length;

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
