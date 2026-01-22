import React from "react";
import { AIModel, MODEL_CONFIGS } from "../types";
import { Sparkles, Settings2, Maximize2, Monitor, MessageSquareText } from "lucide-react";

interface SectionWrapperProps {
  title: string;
  stepNumber: number;
  description?: string;
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
  
  selectedSize: string;
  onSizeChange: (size: string) => void;
  
  selectedAspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;

  onPromptClick: () => void;
  onGenerate: () => void;

  children: React.ReactNode;
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({
  title,
  stepNumber,
  description,
  selectedModel,
  onModelChange,
  selectedSize,
  onSizeChange,
  selectedAspectRatio,
  onAspectRatioChange,
  onPromptClick,
  onGenerate,
  children,
}) => {
  const currentConfig = MODEL_CONFIGS[selectedModel];

  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden mb-8 transition-all hover:shadow-xl">
      {/* Section Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {stepNumber}
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    {title}
                </h2>
                {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
            </div>
        </div>

        {/* Configuration Controls */}
        <div className="flex flex-wrap items-center gap-2">
            
            {/* Prompt Button */}
            <button
                onClick={onPromptClick}
                className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm hover:border-blue-400 hover:text-blue-600 transition-colors group"
                title="Edit Prompt"
            >
                <MessageSquareText size={16} className="text-slate-400 group-hover:text-blue-600" />
                <span className="text-xs font-semibold text-slate-500 uppercase group-hover:text-blue-600">PROMPT</span>
            </button>

            {/* Model Selector */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm" title="AI Model">
                <Settings2 size={16} className="text-slate-400" />
                <span className="hidden sm:inline text-xs font-semibold text-slate-500 uppercase mr-1">Model:</span>
                <select
                    value={selectedModel}
                    onChange={(e) => onModelChange(e.target.value as AIModel)}
                    className="text-sm font-medium text-slate-700 bg-transparent outline-none cursor-pointer hover:text-blue-600 max-w-[160px]"
                >
                    {Object.values(AIModel).map((model) => (
                        <option key={model} value={model}>
                            {model}
                        </option>
                    ))}
                </select>
            </div>

            {/* Size Selector */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm" title="Resolution Size">
                <Maximize2 size={16} className="text-slate-400" />
                <span className="hidden sm:inline text-xs font-semibold text-slate-500 uppercase mr-1">Size:</span>
                <select
                    value={selectedSize}
                    onChange={(e) => onSizeChange(e.target.value)}
                    className="text-sm font-medium text-slate-700 bg-transparent outline-none cursor-pointer hover:text-blue-600"
                >
                    {currentConfig.sizes.map((size) => (
                        <option key={size} value={size}>
                            {size}
                        </option>
                    ))}
                </select>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm" title="Aspect Ratio">
                <Monitor size={16} className="text-slate-400" />
                <span className="hidden sm:inline text-xs font-semibold text-slate-500 uppercase mr-1">Ratio:</span>
                <select
                    value={selectedAspectRatio}
                    onChange={(e) => onAspectRatioChange(e.target.value)}
                    className="text-sm font-medium text-slate-700 bg-transparent outline-none cursor-pointer hover:text-blue-600"
                >
                    {currentConfig.aspectRatios.map((ratio) => (
                        <option key={ratio} value={ratio}>
                            {ratio}
                        </option>
                    ))}
                </select>
            </div>
            
        </div>
      </div>

      {/* Content Body */}
      <div className="p-6">
        {children}
        
        {/* Action Bar */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
            <button 
                onClick={onGenerate}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transition-all active:scale-95"
            >
                <Sparkles size={18} />
                <span>开始生成 / Generate</span>
            </button>
        </div>
      </div>
    </div>
  );
};