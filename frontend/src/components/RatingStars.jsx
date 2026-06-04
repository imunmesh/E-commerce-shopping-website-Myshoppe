import React from 'react';
import { Star } from 'lucide-react';

const RatingStars = ({ rating = 0, onRatingChange = null, size = 20 }) => {
  const stars = [1, 2, 3, 4, 5];
  
  return (
    <div className="flex items-center space-x-1">
      {stars.map((star) => {
        // Handle fractional values for display-only mode
        const isFilled = onRatingChange 
          ? star <= rating 
          : star <= Math.round(rating);
          
        return (
          <button
            key={star}
            type="button"
            disabled={!onRatingChange}
            onClick={() => onRatingChange && onRatingChange(star)}
            className={`transition-all duration-150 focus:outline-none ${onRatingChange ? 'hover:scale-125' : ''}`}
          >
            <Star
              size={size}
              className={`${
                isFilled 
                  ? 'fill-amber-400 text-amber-400' 
                  : 'text-gray-300'
              }`}
            />
          </button>
        );
      })}
      {!onRatingChange && rating > 0 && (
        <span className="text-sm font-semibold ml-2 text-gray-600">{parseFloat(rating).toFixed(1)}</span>
      )}
    </div>
  );
};

export default RatingStars;
