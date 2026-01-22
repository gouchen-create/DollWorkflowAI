import React, { useState, useMemo, useRef, useEffect } from "react";
import { ImageItem } from "../types";
import { Check, Download, Trash2, Upload, AlertCircle } from "lucide-react";

interface ImageGridProps {
  title: string;
  images: ImageItem[];
  setImages: React.Dispatch<React.SetStateAction<ImageItem[]>>;
  allowUpload?: boolean;
  onImageClick?: (image: ImageItem) => void;
  // New props for API integration
  category?: string;
  onUploadFile?: (file: File, category: string) => Promise<void>;
  // Delete capability
  onDelete?: (selectedItems: ImageItem[]) => void;
}

const ITEMS_PER_PAGE = 20;

export const ImageGrid: React.FC<ImageGridProps> = ({
  title,
  images,
  setImages,
  allowUpload = false,
  onImageClick,
  category,
  onUploadFile,
  onDelete
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Inline confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pagination Logic
  const totalPages = Math.ceil(images.length / ITEMS_PER_PAGE);
  const currentImages = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return images.slice(start, start + ITEMS_PER_PAGE);
  }, [images, currentPage]);

  // Reset confirm state if selection is cleared
  useEffect(() => {
      const hasSelection = images.some(i => i.selected);
      if (!hasSelection) {
          setShowDeleteConfirm(false);
      }
  }, [images]);

  // --- Box Selection Logic ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!selectionBox || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSelectionBox((prev) =>
        prev
          ? {
              ...prev,
              currentX: e.clientX - rect.left,
              currentY: e.clientY - rect.top,
            }
          : null
      );
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!selectionBox || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.abs(selectionBox.currentX - selectionBox.startX);
      const height = Math.abs(selectionBox.currentY - selectionBox.startY);
      if (width > 5 || height > 5) {
        const boxLeft = rect.left + Math.min(selectionBox.startX, selectionBox.currentX);
        const boxTop = rect.top + Math.min(selectionBox.startY, selectionBox.currentY);
        const boxRight = boxLeft + width;
        const boxBottom = boxTop + height;
        const idsToSelect = new Set<string>();
        const itemElements = containerRef.current.querySelectorAll("[data-image-id]");
        itemElements.forEach((el) => {
          const itemRect = el.getBoundingClientRect();
          if (
            itemRect.left < boxRight &&
            itemRect.right > boxLeft &&
            itemRect.top < boxBottom &&
            itemRect.bottom > boxTop
          ) {
            const id = el.getAttribute("data-image-id");
            if (id) idsToSelect.add(id);
          }
        });
        if (idsToSelect.size > 0) {
          setImages((prev) =>
            prev.map((img) =>
              idsToSelect.has(img.id) ? { ...img, selected: true } : img
            )
          );
        }
      }
      setSelectionBox(null);
    };
    if (selectionBox) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [selectionBox, setImages]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, label, input, .image-card")) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setSelectionBox({
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      });
    }
  };

  const handleSelect = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, selected: !img.selected } : img
      )
    );
  };

  const handleSelectAll = () => {
    const allSelected = currentImages.every((img) => img.selected);
    setImages((prev) =>
      prev.map((img) =>
        currentImages.find((c) => c.id === img.id)
          ? { ...img, selected: !allSelected }
          : img
      )
    );
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault(); // Prevent focus loss or other side effects

      if (showDeleteConfirm) {
          const selectedItems = images.filter(i => i.selected);
          if (selectedItems.length > 0) {
              onDelete?.(selectedItems);
          }
          setShowDeleteConfirm(false);
      } else {
          setShowDeleteConfirm(true);
      }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowDeleteConfirm(false);
  }

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onUploadFile && category) {
      setIsUploading(true);
      try {
        const files = Array.from(e.target.files);
        for (const file of files) {
            await onUploadFile(file, category);
        }
      } finally {
        setIsUploading(false);
        // Reset input
        e.target.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-white rounded-lg border border-slate-200 shadow-sm h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
          {title} <span className="text-slate-400 font-normal">({images.length})</span>
        </h4>
        
        <div className="flex items-center gap-2">
          {allowUpload && (
             <label className={`cursor-pointer flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-xs font-medium transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
             <Upload size={14} />
             <span>{isUploading ? '上传中...' : '上传'}</span>
             <input type="file" multiple accept="image/*" className="hidden" onChange={handleUploadChange} disabled={isUploading} />
           </label>
          )}

          {onDelete && images.some(i => i.selected) && (
             <div className="flex items-center gap-1">
                {showDeleteConfirm ? (
                    <>
                        <button 
                            type="button" 
                            onClick={handleDeleteClick} 
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium transition-colors animate-in fade-in duration-200"
                        >
                            <AlertCircle size={14} />
                            <span>确认删除?</span>
                        </button>
                         <button 
                            type="button" 
                            onClick={handleCancelDelete} 
                            className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-xs"
                        >
                            取消
                        </button>
                    </>
                ) : (
                    <button 
                        type="button" 
                        onClick={handleDeleteClick} 
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs font-medium transition-colors border border-red-100"
                    >
                        <Trash2 size={14} />
                        <span>删除 ({images.filter(i => i.selected).length})</span>
                    </button>
                )}
             </div>
          )}

          <button onClick={handleSelectAll} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors">
            {currentImages.length > 0 && currentImages.every(i => i.selected) ? "取消全选" : "全选本页"}
          </button>
        </div>
      </div>

      <div ref={containerRef} onMouseDown={handleMouseDown} className="flex-1 min-h-[300px] bg-slate-50 rounded-md p-2 relative select-none overflow-y-auto">
        {selectionBox && (
          <div className="absolute border-2 border-blue-500 bg-blue-500/20 z-50 pointer-events-none" style={{
              left: Math.min(selectionBox.startX, selectionBox.currentX),
              top: Math.min(selectionBox.startY, selectionBox.currentY),
              width: Math.abs(selectionBox.currentX - selectionBox.startX),
              height: Math.abs(selectionBox.currentY - selectionBox.startY),
          }}/>
        )}

        {images.length === 0 ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-md m-2">
             {allowUpload ? (
               <>
                <Upload size={32} className="mb-2 opacity-50" />
                <p className="text-sm">拖入图片 或 点击上传按钮</p>
               </>
             ) : (
                <p className="text-sm">暂无输出图片 / Waiting for results...</p>
             )}
           </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 content-start">
            {currentImages.map((img) => (
              <div
                key={img.id}
                data-image-id={img.id}
                className={`image-card group relative aspect-square rounded-lg overflow-hidden cursor-zoom-in transition-all duration-200 border-2 bg-white ${
                  img.selected ? "border-blue-500 ring-2 ring-blue-500 ring-offset-1" : "border-transparent hover:shadow-lg hover:border-slate-200"
                }`}
                onClick={() => onImageClick?.(img)}
              >
                <img src={img.url} alt={img.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none" />
                <div 
                    className={`absolute top-0 right-0 p-2 cursor-pointer transition-opacity duration-200 z-10 ${img.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onClick={(e) => { e.stopPropagation(); handleSelect(img.id); }}
                >
                    <div className={`w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center shadow-md ${img.selected ? 'bg-blue-500 border-blue-500 text-white' : 'hover:bg-slate-50'}`}>
                        <Check size={16} strokeWidth={3} />
                    </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-2">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className="px-3 py-1 text-xs rounded border disabled:opacity-50">上一页</button>
          <span className="text-xs text-slate-500">{currentPage} / {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="px-3 py-1 text-xs rounded border disabled:opacity-50">下一页</button>
        </div>
      )}
    </div>
  );
};