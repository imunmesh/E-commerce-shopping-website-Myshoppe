import React from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ShoppingCart } from 'lucide-react';
import { addToCart } from '../../store/cartSlice';
import RatingStars from '../RatingStars';

const ChatMessage = ({ msg }) => {
  const dispatch = useDispatch();
  const isUser = msg.sender === 'user';
  
  // Typing animation state for new messages
  const [currentText, setCurrentText] = React.useState(msg.isNew ? '' : msg.message);
  const [isStreaming, setIsStreaming] = React.useState(msg.isNew);

  React.useEffect(() => {
    if (msg.isNew) {
      const words = msg.message.split(' ');
      let currentWordIdx = 0;
      let accumulated = '';
      
      const interval = setInterval(() => {
        if (currentWordIdx < words.length) {
          accumulated += (currentWordIdx > 0 ? ' ' : '') + words[currentWordIdx];
          setCurrentText(accumulated);
          currentWordIdx++;
        } else {
          clearInterval(interval);
          setIsStreaming(false);
          // Mutate the original reference so it won't trigger animation again if state updates
          msg.isNew = false;
        }
      }, 30); // Speedy and natural word rate
      
      return () => clearInterval(interval);
    } else {
      setCurrentText(msg.message);
      setIsStreaming(false);
    }
  }, [msg]);

  // Safe parsing of metadata
  let metadata = {};
  if (msg.metadata) {
    try {
      metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
    } catch (e) {
      console.error('Error parsing message metadata:', e);
    }
  }

  const handleAddToCart = (productId) => {
    dispatch(addToCart({ productId, quantity: 1 }));
    alert('Product added to your cart directly from chat!');
  };

  // Helper to format text with basic bolding and line breaks
  const formatText = (text) => {
    if (!text) return '';
    return text.split('\n').map((line, lineIdx) => {
      // Basic markdown bold parsing: **text**
      const parts = line.split('**');
      return (
        <p key={lineIdx} className={lineIdx > 0 ? 'mt-1 text-xs font-sans leading-relaxed' : 'text-xs font-sans leading-relaxed'}>
          {parts.map((part, partIdx) => {
            if (partIdx % 2 === 1) {
              return <strong key={partIdx} className="font-extrabold text-gray-900">{part}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className={`flex flex-col space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Name label */}
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 px-1">
        {isUser ? 'You' : 'MyShopee Agent'}
      </span>

      {/* Text Bubble */}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-xs border ${
          isUser
            ? 'bg-amazon-blue border-amazon-blue text-white rounded-tr-none'
            : 'bg-white border-gray-150 text-gray-700 rounded-tl-none'
        }`}
      >
        <div className="space-y-1">
          {formatText(currentText)}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3.5 bg-amazon-orange ml-0.5 animate-pulse"></span>
          )}
        </div>
      </div>

      {/* Inline Product Recommendations Carousel */}
      {!isStreaming && metadata.products && metadata.products.length > 0 && (
        <div className="w-full pl-1 pr-4 py-2 overflow-x-auto flex gap-3 select-none no-scrollbar">
          {metadata.products.map((prod) => {
            const originalPrice = parseFloat(prod.price);
            const discountPct = parseFloat(prod.discount || 0);
            const discPrice = discountPct > 0 
              ? originalPrice * (1 - discountPct / 100) 
              : originalPrice;

            // Extract thumbnail
            const imagesList = Array.isArray(prod.images) ? prod.images : [];
            const primaryImage = imagesList.find(img => img.is_primary === true) || imagesList[0];
            const imgUrl = primaryImage
              ? (typeof primaryImage === 'string' ? primaryImage : primaryImage.image_url)
              : prod.thumbnail || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=100';

            return (
              <div
                key={prod.id}
                className="w-48 bg-white rounded-lg border border-gray-200 shadow-xs flex flex-col justify-between shrink-0 hover:shadow-md transition duration-150 p-2.5 space-y-2"
              >
                {/* Image & Detail link */}
                <Link to={`/product/${prod.id}`} className="block relative group">
                  <div className="w-full aspect-square bg-gray-50 rounded flex items-center justify-center p-1 overflow-hidden">
                    <img src={imgUrl} alt={prod.title} className="max-h-full max-w-full object-contain group-hover:scale-105 transition" />
                  </div>
                  {discountPct > 0 && (
                    <span className="absolute top-1 left-1 bg-red-600 text-white font-extrabold text-[8px] py-0.5 px-1 rounded shadow">
                      -{discountPct}%
                    </span>
                  )}
                </Link>

                {/* Details */}
                <div className="space-y-1">
                  <Link to={`/product/${prod.id}`} className="hover:text-amazon-orange transition">
                    <h5 className="font-extrabold text-[11px] text-gray-800 line-clamp-2 leading-tight h-7">{prod.title}</h5>
                  </Link>
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">{prod.brand}</span>
                  
                  <div className="flex items-center gap-1">
                    <RatingStars rating={prod.rating} size={10} />
                    <span className="text-[9px] text-gray-400 font-bold">({parseFloat(prod.rating).toFixed(1)})</span>
                  </div>

                  <div className="flex items-baseline space-x-1.5 pt-1">
                    <span className="font-black text-amazon-orange text-[12px]">${discPrice.toFixed(2)}</span>
                    {discountPct > 0 && (
                      <span className="text-[9px] text-gray-400 line-through">${originalPrice.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                {/* Cart Trigger */}
                {prod.stock > 0 ? (
                  <button
                    onClick={() => handleAddToCart(prod.id)}
                    className="w-full bg-amazon-yellow text-amazon-blue py-1.5 rounded font-bold text-[10px] hover:bg-opacity-95 flex items-center justify-center space-x-1 border border-amazon-yellow shadow-xs transition"
                  >
                    <ShoppingCart size={11} />
                    <span>Add to Cart</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full bg-gray-100 text-gray-400 py-1.5 rounded font-bold text-[10px] cursor-not-allowed"
                  >
                    Out of Stock
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
