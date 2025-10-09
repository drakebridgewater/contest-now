import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  className = '',
  ...props
}) => {
  const textareaClasses = [
    'w-full px-3 py-2 border rounded-lg transition-colors resize-none',
    'focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
    error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300',
    props.disabled ? 'bg-gray-100 cursor-not-allowed' : '',
    className,
  ].join(' ');

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea className={textareaClasses} {...props} />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
};

export default Textarea;