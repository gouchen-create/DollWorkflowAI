import React from "react";
import { X, Download } from "lucide-react";
import { ImageItem } from "../types";

interface LightboxProps {
  image: ImageItem | null;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ image, onClose }) => {
  if (!image) return null;

  return (
    <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 transition-all duration-300"
        onClick={onClose}
    >
      <div 
        className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.url}
          alt={image.name}
          className="max-w-full max-h-[85vh] object-contain rounded-md shadow-2xl"
        />
        
        <div className="mt-4 flex gap-4">
            <button
                onClick={onClose}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
            >
                <X size={24} />
            </button>
            <a
                href={image.url}
                download={image.name}
                className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors shadow-lg flex items-center gap-2 px-6"
                onClick={(e) => e.stopPropagation()}
            >
                <Download size={20} />
                <span className="font-medium">Download</span>
            </a>
        </div>
      </div>
    </div>
  );
};
