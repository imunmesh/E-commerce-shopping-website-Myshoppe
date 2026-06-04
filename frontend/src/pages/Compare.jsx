import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ShoppingCart, Trash2, ArrowLeft, Star, Tag, Info } from 'lucide-react';
import { fetchCompare, removeFromCompare } from '../store/compareSlice';
import { addToCart } from '../store/cartSlice';
import RatingStars from '../components/RatingStars';

const Compare = () => {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.compare);
  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCompare());
    }
  }, [isAuthenticated, dispatch]);

  const handleRemove = (productId) => {
    dispatch(removeFromCompare(productId));
  };

  const handleAddToCart = (productId) => {
    dispatch(addToCart({ productId, quantity: 1 }));
    alert('Product added to your cart.');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amazon-orange"></div>
        <p className="text-gray-500 font-semibold text-sm">Assembling comparison metrics...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white border border-gray-150 rounded-xl text-center shadow-sm space-y-4">
        <div className="text-5xl">📊</div>
        <h2 className="text-2xl font-black text-gray-900">Your Comparison List is Empty</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Go to the home page or category catalog, select the "Compare" check-box on product cards, and compare up to 4 items side-by-side.
        </p>
        <Link to="/" className="mt-4 inline-flex items-center space-x-2 bg-amazon-orange text-white px-6 py-2.5 rounded font-bold text-sm shadow hover:bg-opacity-95 transition">
          <ArrowLeft size={16} />
          <span>Return to Shop</span>
        </Link>
      </div>
    );
  }

  // 1. Highlight calculations
  const parsedPrices = items.map(item => {
    const originalPrice = parseFloat(item.price);
    const discountPct = parseFloat(item.discount || 0);
    return originalPrice * (1 - discountPct / 100);
  });

  const lowestPriceVal = Math.min(...parsedPrices);
  const highestRatingVal = Math.max(...items.map(item => parseFloat(item.rating || 0)));
  const highestDiscountVal = Math.max(...items.map(item => parseFloat(item.discount || 0)));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Product Comparison</h1>
          <p className="text-xs text-gray-400 mt-1">Comparing <span className="font-bold text-gray-700">{items.length} of 4</span> products side-by-side</p>
        </div>
        <Link to="/" className="text-xs font-bold text-amazon-lightBlue hover:underline flex items-center gap-1">
          <ArrowLeft size={14} />
          <span>Back to Catalog</span>
        </Link>
      </div>

      {/* Grid Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className={`grid grid-cols-1 md:grid-cols-${items.length + 1} divide-y md:divide-y-0 md:divide-x divide-gray-150`}>
          
          {/* Label Descriptions Column (only visible on medium screens and up) */}
          <div className="hidden md:flex flex-col bg-gray-50/50 p-6 space-y-6 text-sm font-bold text-gray-400 uppercase tracking-wider justify-between select-none">
            <div className="h-64 flex flex-col justify-end pb-4 border-b border-gray-100">
              <span className="text-xs">Product Details</span>
            </div>
            <div className="py-2 border-b border-gray-100 h-10 flex items-center">Brand</div>
            <div className="py-2 border-b border-gray-100 h-10 flex items-center">Category</div>
            <div className="py-2 border-b border-gray-100 h-10 flex items-center">Rating</div>
            <div className="py-2 border-b border-gray-100 h-10 flex items-center">Offer Discount</div>
            <div className="py-2 border-b border-gray-100 h-10 flex items-center">Final Price</div>
            <div className="py-2 border-b border-gray-100 h-10 flex items-center">Stock Level</div>
            <div className="py-2 h-24 overflow-hidden text-xs lowercase">Description</div>
          </div>

          {/* Product Items Columns */}
          {items.map((prod, idx) => {
            const originalPrice = parseFloat(prod.price);
            const discountPct = parseFloat(prod.discount || 0);
            const discPrice = originalPrice * (1 - discountPct / 100);

            const isLowestPrice = discPrice === lowestPriceVal && items.length > 1;
            const isHighestRating = parseFloat(prod.rating) === highestRatingVal && highestRatingVal > 0 && items.length > 1;
            const isBestValue = discountPct === highestDiscountVal && highestDiscountVal > 0 && items.length > 1;

            const imagesList = Array.isArray(prod.images) ? prod.images : [];
            const primaryImage = imagesList.find(img => img.is_primary === true) || imagesList[0];
            const imgUrl = primaryImage
              ? (typeof primaryImage === 'string' ? primaryImage : primaryImage.image_url)
              : 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=300';

            return (
              <div key={prod.id} className="p-6 flex flex-col justify-between space-y-6 hover:bg-gray-50/20 transition duration-150 relative">
                
                {/* Highlights Ribbon */}
                <div className="absolute top-4 right-4 flex flex-col gap-1.5 items-end">
                  {isLowestPrice && (
                    <span className="bg-green-600 text-white font-extrabold text-[9px] uppercase px-2 py-0.5 rounded shadow tracking-wider flex items-center gap-0.5">
                      <Tag size={9} /> Lowest Price
                    </span>
                  )}
                  {isHighestRating && (
                    <span className="bg-blue-600 text-white font-extrabold text-[9px] uppercase px-2 py-0.5 rounded shadow tracking-wider flex items-center gap-0.5">
                      <Star size={9} className="fill-current" /> Top Rated
                    </span>
                  )}
                  {isBestValue && (
                    <span className="bg-amber-500 text-white font-extrabold text-[9px] uppercase px-2 py-0.5 rounded shadow tracking-wider flex items-center gap-0.5">
                      <Tag size={9} /> Best Value
                    </span>
                  )}
                </div>

                {/* Card Header: Remove button, image, title */}
                <div className="space-y-4 border-b border-gray-100 pb-4 h-64 flex flex-col justify-between relative">
                  <button
                    onClick={() => handleRemove(prod.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition absolute -top-2 -left-2"
                    title="Remove from compare"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="h-32 flex items-center justify-center pt-4">
                    <img src={imgUrl} alt={prod.title} className="max-h-full max-w-full object-contain" />
                  </div>

                  <div className="space-y-1">
                    <Link to={`/product/${prod.id}`} className="hover:text-amazon-orange transition-colors">
                      <h4 className="font-extrabold text-sm text-gray-900 line-clamp-2">{prod.title}</h4>
                    </Link>
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-extrabold">{prod.brand}</span>
                  </div>
                </div>

                {/* Properties list */}
                
                {/* Brand */}
                <div className="h-10 border-b border-gray-100 flex items-center justify-between md:justify-start text-xs font-semibold text-gray-700">
                  <span className="md:hidden text-gray-400 font-bold uppercase text-[10px]">Brand:</span>
                  <span>{prod.brand}</span>
                </div>

                {/* Category */}
                <div className="h-10 border-b border-gray-100 flex items-center justify-between md:justify-start text-xs font-semibold text-gray-700">
                  <span className="md:hidden text-gray-400 font-bold uppercase text-[10px]">Category:</span>
                  <span className="uppercase tracking-wider">{prod.category}</span>
                </div>

                {/* Rating */}
                <div className="h-10 border-b border-gray-100 flex items-center justify-between md:justify-start text-xs font-semibold text-gray-700 gap-1.5">
                  <span className="md:hidden text-gray-400 font-bold uppercase text-[10px]">Rating:</span>
                  <div className="flex items-center gap-1">
                    <RatingStars rating={prod.rating} size={14} />
                    <span className="text-gray-400 font-bold">({parseFloat(prod.rating).toFixed(1)})</span>
                  </div>
                </div>

                {/* Discount */}
                <div className="h-10 border-b border-gray-100 flex items-center justify-between md:justify-start text-xs font-semibold text-gray-700">
                  <span className="md:hidden text-gray-400 font-bold uppercase text-[10px]">Discount:</span>
                  {discountPct > 0 ? (
                    <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100">
                      -{discountPct}% OFF
                    </span>
                  ) : (
                    <span className="text-gray-400">None</span>
                  )}
                </div>

                {/* Pricing */}
                <div className="h-10 border-b border-gray-100 flex items-center justify-between md:justify-start text-xs font-semibold text-gray-700 gap-2">
                  <span className="md:hidden text-gray-400 font-bold uppercase text-[10px]">Price:</span>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="font-extrabold text-amazon-orange text-sm">${discPrice.toFixed(2)}</span>
                    {discountPct > 0 && (
                      <span className="text-[10px] text-gray-400 line-through">${originalPrice.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                {/* Stock Level */}
                <div className="h-10 border-b border-gray-100 flex items-center justify-between md:justify-start text-xs font-semibold text-gray-700">
                  <span className="md:hidden text-gray-400 font-bold uppercase text-[10px]">Availability:</span>
                  {prod.stock > 0 ? (
                    <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">In Stock ({prod.stock})</span>
                  ) : (
                    <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full">Out of Stock</span>
                  )}
                </div>

                {/* Description */}
                <div className="h-24 overflow-y-auto text-xs text-gray-500 leading-relaxed p-2 bg-gray-50 rounded border border-gray-150">
                  <span className="md:hidden text-gray-400 font-bold uppercase text-[10px] block mb-1">Description:</span>
                  {prod.description}
                </div>

                {/* Actions */}
                <div className="pt-2">
                  {prod.stock > 0 ? (
                    <button
                      onClick={() => handleAddToCart(prod.id)}
                      className="w-full bg-amazon-yellow text-amazon-blue py-2 px-4 rounded-md font-bold text-xs shadow hover:bg-opacity-95 flex items-center justify-center space-x-1.5 transition active:scale-95 border border-amazon-yellow"
                    >
                      <ShoppingCart size={13} />
                      <span>Add to Cart</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full bg-gray-100 text-gray-400 py-2 px-4 rounded-md font-bold text-xs cursor-not-allowed"
                    >
                      Out of Stock
                    </button>
                  )}
                </div>

              </div>
            );
          })}

        </div>
      </div>
      
    </div>
  );
};

export default Compare;
