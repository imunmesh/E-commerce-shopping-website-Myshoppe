import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Heart, Trash2, ShoppingCart, Info } from 'lucide-react';
import { fetchWishlist, removeFromWishlist, moveToCart } from '../store/wishlistSlice';
import RatingStars from '../components/RatingStars';

const Wishlist = () => {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.wishlist);
  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchWishlist());
    }
  }, [isAuthenticated, dispatch]);

  const handleRemove = (productId) => {
    dispatch(removeFromWishlist(productId));
  };

  const handleMoveToCart = (productId) => {
    dispatch(moveToCart(productId));
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 max-w-md mx-auto flex flex-col items-center">
          <Heart size={48} className="text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Your Wishlist</h2>
          <p className="text-gray-500 mt-2">Sign in to view your favorite items and save products.</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="bg-gray-200 h-80 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-black text-gray-900 mb-8 tracking-tight flex items-center space-x-2">
        <span>Your Wishlist</span>
      </h1>

      {items.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-100 text-center shadow-sm flex flex-col items-center">
          <Heart size={64} className="text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Your Wishlist is Empty</h2>
          <p className="text-gray-500 mt-2">Save items you like to buy them later or keep track of stock levels.</p>
          <Link to="/" className="mt-6 bg-amazon-orange text-white px-6 py-2.5 rounded-md font-semibold text-sm shadow hover:bg-opacity-95">
            Discover Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item) => {
            const originalPrice = parseFloat(item.price);
            const discountPct = parseFloat(item.discount || 0);
            const hasDiscount = discountPct > 0;
            const discountedPrice = hasDiscount 
              ? originalPrice * (1 - discountPct / 100) 
              : originalPrice;

            return (
              <div key={item.wishlist_id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex flex-col group relative">
                
                {/* Trash Icon */}
                <button
                  onClick={() => handleRemove(item.product_id)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-white bg-opacity-80 hover:bg-opacity-100 shadow text-gray-400 hover:text-red-500 transition duration-150 z-10"
                  title="Remove from Wishlist"
                >
                  <Trash2 size={16} />
                </button>

                {/* Thumbnail */}
                <Link to={`/product/${item.product_id}`} className="aspect-square bg-gray-50 rounded border border-gray-50 p-2 flex items-center justify-center mb-4">
                  <img
                    src={item.thumbnail || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80'}
                    alt={item.title}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </Link>

                {/* Details */}
                <Link to={`/product/${item.product_id}`} className="hover:text-amazon-orange transition-colors">
                  <h3 className="font-bold text-gray-900 line-clamp-2 text-sm h-10 mb-2">
                    {item.title}
                  </h3>
                </Link>

                {/* Rating */}
                <div className="mb-2">
                  <RatingStars rating={item.rating} size={14} />
                </div>

                {/* Price */}
                <div className="flex items-baseline space-x-2 mb-4">
                  <span className="text-base font-black text-amazon-orange">
                    ${discountedPrice.toFixed(2)}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-gray-400 line-through">
                      ${originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-auto pt-2 space-y-2">
                  {item.stock > 0 ? (
                    <button
                      onClick={() => handleMoveToCart(item.product_id)}
                      className="w-full bg-amazon-yellow hover:bg-opacity-95 text-amazon-blue py-1.5 rounded text-xs font-bold shadow flex items-center justify-center space-x-1.5"
                    >
                      <ShoppingCart size={14} />
                      <span>Move to Cart</span>
                    </button>
                  ) : (
                    <div className="text-center bg-gray-100 text-gray-400 py-1.5 rounded text-xs font-semibold">
                      Out of Stock
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
