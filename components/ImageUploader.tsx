import React, { useRef } from 'react';
import { UploadedImage } from '../types';

interface ImageUploaderProps {
  onUpload: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
  subLabel?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  onUpload, 
  multiple = false,
  label = "Upload Image",
  subLabel
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
      // Reset value so same file can be selected again if needed
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div 
      className="border-2 border-dashed border-retro-border bg-retro-panel/50 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-retro-panel hover:border-retro-accent transition-colors h-full min-h-[160px]"
      onClick={() => inputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={inputRef} 
        className="hidden" 
        accept="image/*" 
        multiple={multiple} 
        onChange={handleFileChange}
      />
      <div className="text-retro-accent mb-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </div>
      <p className="font-mono text-lg font-bold text-slate-300">{label}</p>
      {subLabel && <p className="font-sans text-xs text-slate-500 mt-1">{subLabel}</p>}
    </div>
  );
};