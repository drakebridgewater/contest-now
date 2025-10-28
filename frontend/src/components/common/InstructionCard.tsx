import React from 'react';

interface InstructionCardProps {
  title: string;
  instructions: string[];
  icon?: string;
  variant?: 'info' | 'success' | 'warning';
  className?: string;
}

const InstructionCard: React.FC<InstructionCardProps> = ({
  title,
  instructions,
  icon = '📋',
  variant = 'info',
  className = ''
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getVariantClasses()} ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      <ul className="space-y-2">
        {instructions.map((instruction, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-sm font-bold mt-1 min-w-5">{index + 1}.</span>
            <span className="text-sm leading-relaxed">{instruction}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InstructionCard;