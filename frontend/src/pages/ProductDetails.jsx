import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ShoppingCart, Heart, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import RatingStars from '../components/RatingStars';
import { addToCart } from '../store/cartSlice';
import { addToWishlist, removeFromWishlist } from '../store/wishlistSlice';

const ProductDetails = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const wishlistItems = useSelector((state) => state.wishlist.items);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Review states
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [reviewImage, setReviewImage] = useState(null);
  const [reviewImagePreview, setReviewImagePreview] = useState('');
  const [reviewSubmitLoading, setReviewSubmitLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Recently Viewed state
  const [recentlyViewed, setRecentlyViewed] = useState([]);

  useEffect(() => {
    fetchProductDetails();
  }, [id]);

  useEffect(() => {
    if (product) {
      setIsWishlisted(wishlistItems.some((item) => item.product_id === product.id));
    }
  }, [product, wishlistItems]);

  useEffect(() => {
    if (product && isAuthenticated) {
      logProductView();
      fetchRecentlyViewed();
    }
  }, [id, product, isAuthenticated]);

  const logProductView = async () => {
    try {
      await api.post(`/products/${product.id}/view`);
    } catch (err) {
      console.error('Failed to log product view:', err);
    }
  };

  const fetchRecentlyViewed = async () => {
    try {
      const res = await api.get('/products/recently-viewed');
      setRecentlyViewed(res.data.filter((p) => p.id !== product.id));
    } catch (err) {
      console.error('Failed to fetch recently viewed:', err);
    }
  };

  const fetchProductDetails = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/products/${id}`);
      const data = response.data;
      setProduct(data);
      
      // Default to first image
      const imgs = Array.isArray(data.images) ? data.images : [];
      if (imgs.length > 0) {
        setActiveImage(typeof imgs[0] === 'string' ? imgs[0] : imgs[0].image_url);
      }
    } catch (error) {
      console.error('Failed to load product details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWishlistToggle = () => {
    if (!isAuthenticated) {
      alert('Please sign in to manage your wishlist!');
      return;
    }

    if (isWishlisted) {
      dispatch(removeFromWishlist(product.id));
    } else {
      dispatch(addToWishlist(product.id));
    }
  };

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      alert('Please sign in to add items to your cart!');
      return;
    }
    dispatch(addToCart({ productId: product.id, quantity }));
    alert(`Added ${quantity} item(s) to your cart.`);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    setReviewSubmitLoading(true);

    const formData = new FormData();
    formData.append('productId', product.id);
    formData.append('rating', userRating);
    formData.append('comment', userComment);
    if (reviewImage) {
      formData.append('reviewImage', reviewImage);
    }

    try {
      await api.post('/reviews', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setUserComment('');
      setUserRating(5);
      setReviewImage(null);
      setReviewImagePreview('');
      // Reload details to show the new review and updated rating
      await fetchProductDetails();
    } catch (error) {
      setReviewError(error.response?.data?.error || 'Failed to submit review.');
    } finally {
      setReviewSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-200 aspect-square w-full rounded-lg"></div>
          <div className="space-y-4">
            <div className="bg-gray-200 h-8 rounded w-3/4"></div>
            <div className="bg-gray-200 h-6 rounded w-1/4"></div>
            <div className="bg-gray-200 h-24 rounded"></div>
            <div className="bg-gray-200 h-10 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Product Not Found</h2>
        <p className="text-gray-500 mt-2">The product you are trying to view does not exist.</p>
        <Link to="/" className="mt-4 inline-block bg-amazon-orange text-white px-6 py-2 rounded-md font-semibold text-sm">
          Return to Shop
        </Link>
      </div>
    );
  }

  // Cost maths
  const originalPrice = parseFloat(product.price);
  const discountPct = parseFloat(product.discount || 0);
  const hasDiscount = discountPct > 0;
  const discountedPrice = hasDiscount 
    ? originalPrice * (1 - discountPct / 100) 
    : originalPrice;

  const imagesList = Array.isArray(product.images) ? product.images : [];

  // Check if current user has already reviewed
  const userHasReviewed = product.reviews?.some(r => r.user_id === user?.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Product Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        
        {/* Left Column: Image Gallery */}
        <div className="flex flex-col space-y-4">
          
          {/* Main Focus Image */}
          <div className="aspect-square bg-gray-50 border border-gray-100 rounded-lg p-6 flex items-center justify-center relative">
            {hasDiscount && (
              <span className="absolute top-4 left-4 bg-red-600 text-white font-bold text-xs py-1 px-2.5 rounded shadow">
                -{discountPct}% OFF
              </span>
            )}
            
            <img
              src={activeImage || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80'}
              alt={product.title}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Thumbnail list */}
          {imagesList.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {imagesList.map((img, index) => {
                const url = typeof img === 'string' ? img : img.image_url;
                const isActive = activeImage === url;
                return (
                  <button
                    key={index}
                    onClick={() => setActiveImage(url)}
                    className={`w-16 h-16 border rounded p-1 flex items-center justify-center bg-white transition-all ${
                      isActive ? 'border-amazon-orange ring-2 ring-amazon-orange/10' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <img src={url} alt={`product-thumb-${index}`} className="max-h-full max-w-full object-contain" />
                  </button>
                );
              })}
            </div>
          )}

        </div>

        {/* Right Column: Text Metadata */}
        <div className="flex flex-col justify-between">
          <div className="space-y-4">
            
            {/* Category & Brand */}
            <div className="flex items-center space-x-2">
              <span className="bg-gray-100 text-gray-800 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {product.category}
              </span>
              <span className="text-sm font-semibold text-gray-400">
                Brand: {product.brand}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">{product.title}</h1>

            {/* Ratings Summary */}
            <div className="flex items-center space-x-2">
              <RatingStars rating={product.rating} size={18} />
              <span className="text-sm text-gray-500 font-semibold border-l border-gray-200 pl-2">
                {product.reviews?.length || 0} customer reviews
              </span>
            </div>

            {/* Prices */}
            <div className="flex items-baseline space-x-3 py-2">
              <span className="text-3xl font-black text-amazon-orange">
                ${discountedPrice.toFixed(2)}
              </span>
              {hasDiscount && (
                <span className="text-lg text-gray-400 line-through">
                  ${originalPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-600 leading-relaxed text-sm">{product.description}</p>
            
          </div>

          <div className="border-t border-gray-100 pt-6 mt-6 space-y-6">
            
            {/* Stock Level */}
            <div className="flex items-center space-x-3 text-sm">
              <span className="font-semibold text-gray-700">Availability:</span>
              {product.stock > 0 ? (
                <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                  In Stock ({product.stock} items left)
                </span>
              ) : (
                <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full">
                  Out of Stock
                </span>
              )}
            </div>

            {/* Quantity Picker & Add buttons */}
            {product.stock > 0 && (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center border border-gray-200 rounded-md">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="px-3 py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold rounded-l-md"
                  >
                    -
                  </button>
                  <span className="px-4 text-sm font-bold text-gray-800">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                    className="px-3 py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold rounded-r-md"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="flex-1 bg-amazon-yellow text-amazon-blue font-bold px-6 py-3 rounded-md shadow hover:bg-opacity-95 flex items-center justify-center space-x-2 transition duration-150 border border-amazon-yellow min-w-[200px]"
                >
                  <ShoppingCart size={18} />
                  <span>Add to Shopping Cart</span>
                </button>

                <button
                  onClick={handleWishlistToggle}
                  className={`p-3 rounded-md border shadow transition duration-150 ${
                    isWishlisted 
                      ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' 
                      : 'border-gray-200 hover:bg-gray-50 text-gray-500'
                  }`}
                  title="Add to Wishlist"
                >
                  <Heart size={20} className={isWishlisted ? 'fill-current' : ''} />
                </button>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Review Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Review Submission Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4">
            Customer Feedback
          </h3>

          {!isAuthenticated ? (
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 text-center">
              <AlertCircle className="mx-auto text-yellow-600 mb-2" size={24} />
              <p className="text-sm text-yellow-700 font-medium">Please sign in to write a review and rate this product.</p>
              <Link to="/login" className="mt-3 inline-block bg-amazon-blue text-white px-4 py-1.5 rounded text-sm font-semibold hover:bg-opacity-95">
                Sign In
              </Link>
            </div>
          ) : userHasReviewed ? (
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
              <p className="text-sm text-green-700 font-medium">You have already submitted a review for this product. Thank you!</p>
            </div>
          ) : (
            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Overall Rating
                </label>
                <RatingStars rating={userRating} onRatingChange={setUserRating} size={24} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Write Your Review
                </label>
                <textarea
                  rows="4"
                  placeholder="Share your experience with this product..."
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amazon-yellow focus:bg-white transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Upload Product Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        alert('Image file size must be under 5MB.');
                        return;
                      }
                      setReviewImage(file);
                      setReviewImagePreview(URL.createObjectURL(file));
                    }
                  }}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                />
                {reviewImagePreview && (
                  <div className="mt-2.5 relative inline-block">
                    <img src={reviewImagePreview} alt="Review Preview" className="h-16 rounded border object-cover" />
                    <button
                      type="button"
                      onClick={() => { setReviewImage(null); setReviewImagePreview(''); }}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center text-[10px] font-bold hover:bg-red-600 shadow"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {reviewError && (
                <p className="text-red-600 text-xs font-semibold flex items-center space-x-1">
                  <span>⚠️ {reviewError}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={reviewSubmitLoading}
                className="w-full bg-amazon-orange text-white py-2 rounded-md font-semibold text-sm shadow hover:bg-opacity-95 active:scale-95 transition"
              >
                {reviewSubmitLoading ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          )}
        </div>

        {/* Reviews List */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h3 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-3">
            Customer Reviews ({product.reviews?.length || 0})
          </h3>

          {(!product.reviews || product.reviews.length === 0) ? (
            <div className="py-12 text-center text-gray-400 flex flex-col items-center">
              <MessageSquare size={32} className="mb-2" />
              <p className="text-sm font-semibold">No reviews yet. Be the first to review this product!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {product.reviews.map((rev) => (
                <div key={rev.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800 text-sm flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-amazon-lightBlue text-white flex items-center justify-center font-bold text-xs uppercase">
                        {rev.user_name?.slice(0, 2)}
                      </div>
                      <span>{rev.user_name}</span>
                    </span>
                    <span className="text-xs text-gray-400 flex items-center space-x-1">
                      <Calendar size={12} />
                      <span>{new Date(rev.created_at).toLocaleDateString()}</span>
                    </span>
                  </div>
                  
                  <div className="mt-2.5">
                    <RatingStars rating={rev.rating} size={14} />
                  </div>
                  
                  <p className="text-gray-600 text-sm mt-2 leading-relaxed bg-gray-50 p-3 rounded border border-gray-100 font-sans italic">
                    "{rev.comment}"
                  </p>

                  {rev.image_url && (
                    <div className="mt-3">
                      <a href={rev.image_url} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={rev.image_url} 
                          alt="Customer review uploaded image" 
                          className="max-h-24 rounded border border-gray-200 object-contain hover:shadow-md transition cursor-zoom-in"
                        />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* You Recently Viewed Carousel Section */}
      {isAuthenticated && recentlyViewed.length > 0 && (
        <div className="mt-12 bg-white p-6 rounded-xl border border-gray-250/60 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 mb-6 flex items-center gap-1.5">
            <span>You Recently Viewed</span>
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

export default ProductDetails;
