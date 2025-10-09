import React, { useRef } from 'react';
import { Upload, ImageIcon } from 'lucide-react';
import { Button } from '@/components/common';

interface ImageUploadProps {
  onChange: (file: string) => void;
  preview: string | null;
  disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onChange,
  preview,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        onChange(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Upload Photo *
      </label>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-indigo-500 cursor-pointer'
        }`}
        onClick={triggerFileInput}
      >
        {preview ? (
          <div className="space-y-4">
            <img
              src={preview}
              alt="Preview"
              className="max-h-64 mx-auto rounded-lg shadow-md"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                triggerFileInput();
              }}
              disabled={disabled}
            >
              <Upload className="w-5 h-5 mr-2" />
              Change Photo
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <ImageIcon className="w-16 h-16 mx-auto text-gray-400" />
            <div>
              <p className="text-gray-600 mb-2">Click to upload photo</p>
              <p className="text-sm text-gray-400">PNG, JPG up to 10MB</p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
};

export default ImageUpload;
