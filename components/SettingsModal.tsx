import React, { useState, useEffect } from "react";
import { X, Save, FolderOpen, Cpu, Key, Cloud, Globe } from "lucide-react";
import { AppSettings, DEFAULT_SETTINGS } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  currentSettings: AppSettings;
  // New props for dynamic API configuration
  apiEndpoint?: string;
  onApiEndpointChange?: (url: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSettings,
  apiEndpoint,
  onApiEndpointChange
}) => {
  const [formData, setFormData] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [localApiUrl, setLocalApiUrl] = useState("");
  // Track if user has modified the form to prevent overwriting by polling
  const [isDirty, setIsDirty] = useState(false);

  // Reset dirty state when modal is closed
  useEffect(() => {
    if (!isOpen) {
        setIsDirty(false);
    }
  }, [isOpen]);

  // Sync with props only if the form hasn't been touched by user
  useEffect(() => {
    if (isOpen && !isDirty) {
      setFormData(currentSettings);
      if (apiEndpoint) setLocalApiUrl(apiEndpoint);
    }
  }, [isOpen, currentSettings, apiEndpoint, isDirty]);

  if (!isOpen) return null;

  const handleChange = (field: keyof AppSettings, value: string | number) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save API Endpoint change
    if (onApiEndpointChange && localApiUrl !== apiEndpoint) {
        onApiEndpointChange(localApiUrl);
    }
    // Save other settings
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            系统设置 (System Settings)
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
            
          {/* Connection Settings */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Globe size={14} />
              Connection Settings (Backend)
            </h3>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Backend API Endpoint
              </label>
              <div className="flex gap-2">
                  <input
                    type="text"
                    value={localApiUrl}
                    onChange={(e) => {
                        setLocalApiUrl(e.target.value);
                        setIsDirty(true);
                    }}
                    placeholder="http://localhost:3001/api"
                    className="flex-1 px-3 py-2 bg-blue-50/50 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-blue-800"
                  />
              </div>
              <p className="text-xs text-slate-500">
                Default: <code>http://localhost:3001/api</code>
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* API Keys Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Key size={14} />
              API Credentials
            </h3>
            
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                极客智坊 API Key (GeekAI)
              </label>
              <input
                type="password"
                value={formData.geekaiApiKey}
                onChange={(e) => handleChange("geekaiApiKey", e.target.value)}
                placeholder="Enter your GeekAI API key (GEEKAI_API_KEY)..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Aliyun OSS Configuration Section */}
          <div className="space-y-4">
             <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Cloud size={14} />
              阿里云 OSS 配置 (Aliyun OSS)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Access Key ID</label>
                    <input
                        type="password"
                        value={formData.ossAccessKeyId}
                        onChange={(e) => handleChange("ossAccessKeyId", e.target.value)}
                        placeholder="LTAI..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Access Key Secret</label>
                    <input
                        type="password"
                        value={formData.ossAccessKeySecret}
                        onChange={(e) => handleChange("ossAccessKeySecret", e.target.value)}
                        placeholder="Secret..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Endpoint</label>
                    <input
                        type="text"
                        value={formData.ossEndpoint}
                        onChange={(e) => handleChange("ossEndpoint", e.target.value)}
                        placeholder="oss-cn-hangzhou.aliyuncs.com"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Bucket Name</label>
                    <input
                        type="text"
                        value={formData.ossBucketName}
                        onChange={(e) => handleChange("ossBucketName", e.target.value)}
                        placeholder="my-bucket-name"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">存储目录 (Folder)</label>
                    <input
                        type="text"
                        value={formData.ossFolder}
                        onChange={(e) => handleChange("ossFolder", e.target.value)}
                        placeholder="doll-workflow/"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                    />
                </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Performance & Storage Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
               <Cpu size={14} />
               本地与性能 (Local & Performance)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  并发数 (Threads)
                </label>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={formData.concurrency}
                  onChange={(e) => handleChange("concurrency", parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                本地工作目录 (Working Directory)
              </label>
              <div className="flex gap-2">
                <input
                    type="text"
                    value={formData.workingDirectory}
                    onChange={(e) => handleChange("workingDirectory", e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                />
              </div>
              <p className="text-xs text-slate-500">
                Data will be saved to this local path.
              </p>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white border-t border-slate-100 py-4 mt-4">
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
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};