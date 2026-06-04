import React from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Heart, ShoppingCart } from 'lucide-react';
import RatingStars from './RatingStars';
import { addToCart } from '../store/cartSlice';
import { addToWishlist, removeFromWishlist } from '../store/wishlistSlice';
import { addToCompare, removeFromCompare } from '../store/compareSlice';

const ProductCard = ({ product }) => {
  const dispatch = useDispatch();
  const wishlistItems = useSelector((state) => state.wishlist.items);
  const { isAuthenticated } = useSelector((state) => state.auth);

  const isWishlisted = wishlistItems.some((item) => item.product_id === product.id);
  const compareItems = useSelector((state) => state.compare.items);
  const isCompared = compareItems.some((item) => item.product_id === product.id || item.id === product.id);

  const handleCompareToggle = (e) => {
    // Prevent default check state change because we manage it through Redux state and async API requests
    e.preventDefault();
    if (isCompared) {
      dispatch(removeFromCompare(product.id));
    } else {
      if (compareItems.length >= 4) {
        alert('You can compare up to 4 products at a time. Please remove an item first.');
        return;
      }
      dispatch(addToCompare(product.id));
    }
  };

  // Compute pricing
  const originalPrice = parseFloat(product.price);
  const discountPct = parseFloat(product.discount || 0);
  const hasDiscount = discountPct > 0;
  const discountedPrice = hasDiscount 
    ? originalPrice * (1 - discountPct / 100) 
    : originalPrice;

  // Extract thumbnail image URL with Cloudinary optimization
  const imagesList = Array.isArray(product.images) ? product.images : [];
  const primaryImage = imagesList.find(img => img.is_primary === true) || imagesList[0];
  const thumbnail = primaryImage
    ? (typeof primaryImage === 'string' ? primaryImage : primaryImage.image_url)
    : product.thumbnail || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80';

  // Generate Cloudinary optimized URLs for responsive images
  const generateResponsiveUrls = (imageUrl) => {
    if (!imageUrl || !imageUrl.includes('cloudinary')) {
      return {
        small: imageUrl,
        medium: imageUrl,
        large: imageUrl
      };
    }

    // Check if URL already contains Cloudinary transformations
    const uploadIndex = imageUrl.indexOf('/upload/');
    if (uploadIndex === -1) {
      return {
        small: imageUrl,
        medium: imageUrl,
        large: imageUrl
      };
    }

    const baseUrl = imageUrl.substring(0, uploadIndex + 8); // includes '/upload/'
    const afterUpload = imageUrl.substring(uploadIndex + 8);

    // Check if the part after /upload/ starts with transformation parameters (f_auto, q_auto, etc.)
    // If it does, the URL already has transformations - use as-is
    if (afterUpload.match(/^(f_|q_|w_|h_|c_)/)) {
      return {
        small: imageUrl,
        medium: imageUrl,
        large: imageUrl
      };
    }

    // No transformations found, add them
    return {
      small: `${baseUrl}f_auto,q_auto,w_300,h_300,c_fill/${afterUpload}`,
      medium: `${baseUrl}f_auto,q_auto,w_500,h_500,c_fill/${afterUpload}`,
      large: `${baseUrl}f_auto,q_auto,w_800,h_800,c_fill/${afterUpload}`
    };
  };

  const responsiveUrls = generateResponsiveUrls(thumbnail);

  const handleWishlistToggle = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Please sign in to add items to your wishlist!');
      return;
    }
    
    if (isWishlisted) {
      dispatch(removeFromWishlist(product.id));
    } else {
      dispatch(addToWishlist(product.id));
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Please sign in to buy products!');
      return;
    }
    dispatch(addToCart({ productId: product.id, quantity: 1 }));
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 flex flex-col group relative overflow-hidden border border-gray-100">
      {/* Wishlist Button Overlay */}
      <button
        onClick={handleWishlistToggle}
        className="absolute top-3 right-3 p-1.5 rounded-full bg-white bg-opacity-80 hover:bg-opacity-100 shadow transition duration-150 z-10"
      >
        <Heart
          size={18}
          className={`${
            isWishlisted ? 'fill-red-500 text-red-500 animate-pulse' : 'text-gray-400 hover:text-red-500'
          }`}
        />
      </button>

      {/* Discount Badge */}
      {hasDiscount && (
        <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow z-10">
          -{discountPct}% OFF
        </div>
      )}

      {/* Product Image */}
      <Link to={`/product/${product.id}`} className="aspect-square w-full overflow-hidden bg-gray-50 flex items-center justify-center p-4">
        <img
          src={responsiveUrls.medium}
          srcSet={`${responsiveUrls.small} 300w, ${responsiveUrls.medium} 500w, ${responsiveUrls.large} 800w`}
          sizes="(max-width: 640px) 300px, (max-width: 1024px) 500px, 800px"
          alt={product.title}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />
      </Link>

      {/* Details container */}
      <div className="p-4 flex flex-col flex-1">
        
        {/* Category & Brand */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
            {product.category}
          </span>
          {isAuthenticated && (
            <label className="flex items-center space-x-1 cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isCompared}
                onChange={handleCompareToggle}
                className="rounded text-amazon-orange focus:ring-amazon-orange w-3.5 h-3.5 border-gray-300 cursor-pointer"
              />
              <span className="font-bold text-[10px] text-gray-500 uppercase hover:text-amazon-orange tracking-wide">Compare</span>
            </label>
          )}
        </div>

        {/* Title */}
        <Link to={`/product/${product.id}`} className="hover:text-amazon-orange transition-colors">
          <h3 className="font-bold text-gray-900 line-clamp-2 text-sm h-10 mb-2">
            {product.title}
          </h3>
        </Link>

        {/* Rating Stars */}
        <div className="mb-2">
          <RatingStars rating={product.rating} size={15} />
        </div>

        {/* Pricing Structure */}
        <div className="flex items-baseline space-x-2 mt-auto mb-4">
          <span className="text-lg font-black text-amazon-orange">
            ${discountedPrice.toFixed(2)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-gray-400 line-through">
              ${originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Cart Button */}
        {product.stock > 0 ? (
          <button
            onClick={handleAddToCart}
            className="w-full bg-amazon-yellow text-amazon-blue py-2 rounded-md font-semibold text-sm shadow hover:bg-opacity-90 active:scale-95 transition-all flex items-center justify-center space-x-2 border border-amazon-yellow"
          >
            <ShoppingCart size={16} />
            <span>Add to Cart</span>
          </button>
        ) : (
          <button
            disabled
            className="w-full bg-gray-200 text-gray-400 py-2 rounded-md font-semibold text-sm cursor-not-allowed flex items-center justify-center space-x-2"
          >
            Out of Stock
          </button>
        )}

      </div>
    </div>
  );
};

export default ProductCard;
