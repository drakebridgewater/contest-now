import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  title: string;
  description: string;
  disabled?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  title,
  description,
  disabled = false,
}) => {
  const [hoveredRating, setHoveredRating] = useState<number>(0);

  const handleStarClick = (rating: number) => {
    if (!disabled) {
      onChange(rating);
    }
  };

  const handleStarHover = (rating: number) => {
    if (!disabled) {
      setHoveredRating(rating);
    }
  };

  const handleMouseLeave = () => {
    if (!disabled) {
      setHoveredRating(0);
    }
  };

  const isRated = value > 0;
  const titleColorClass = isRated ? 'text-green-700' : 'text-red-600';
  const requiredIndicator = !isRated ? ' (Required)' : '';

  return (
    <div className="mb-4">
      <div className="mb-2">
        <h4 className={`text-sm font-medium ${titleColorClass}`}>
          {title}{requiredIndicator}
        </h4>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div className="flex gap-1" onMouseLeave={handleMouseLeave}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isActive = star <= (hoveredRating || value);
          return (
            <Star
              key={star}
              className={`w-6 h-6 transition-colors ${
                disabled
                  ? 'cursor-not-allowed text-gray-300'
                  : 'cursor-pointer'
              } ${
                isActive
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300 hover:text-yellow-200'
              }`}
              onMouseEnter={() => handleStarHover(star)}
              onClick={() => handleStarClick(star)}
            />
          );
        })}
        <span className={`ml-2 text-sm font-medium ${
          value > 0 ? 'text-green-600' : 'text-red-500'
        }`}>
          {value > 0 ? `★ ${value}` : '⚠ Required'}
        </span>
      </div>
    </div>
  );
};

export default StarRating;