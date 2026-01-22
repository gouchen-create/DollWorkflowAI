import React, { useState, useEffect } from "react";
import { X, Save, MessageSquareText } from "lucide-react";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newPrompt: string) => void;
  title: string;
  initialPrompt: string;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  initialPrompt,
}) => {
  const [promptText, setPromptText] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPromptText(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(promptText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-xl">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <MessageSquareText size={20} className="text-blue-600" />
            Prompt Settings: <span className="text-slate-600 font-normal">{title}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 flex-1 overflow-y-auto">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              提示词 (Prompt)
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full h-64 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all leading-relaxed resize-none"
              placeholder="Enter your prompt here..."
            />
            <p className="text-xs text-slate-500 mt-2">
              Use "Save" to persist these changes to your configuration file.
            </p>
          </div>

          <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end gap-3 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95"
            >
              <Save size={16} />
              Save Prompt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};