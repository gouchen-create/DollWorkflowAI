import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { AIModel, ImageItem, AppSettings, DEFAULT_SETTINGS, LogEntry, TaskItem, WorkflowStage, MODEL_CONFIGS, GenerateRequest } from "./types";
import { SectionWrapper } from "./components/SectionWrapper";
import { ImageGrid } from "./components/ImageGrid";
import { Lightbox } from "./components/Lightbox";
import { SettingsModal } from "./components/SettingsModal";
import { SystemLogsModal } from "./components/SystemLogsModal";
import { TaskListModal } from "./components/TaskListModal";
import { PromptModal } from "./components/PromptModal";
import { Shirt, User, Scissors, Image as ImageIcon, Copy, Settings, FileText, List, Link2Off } from "lucide-react";

// --- Simple Local Auto-Detection Logic ---
const detectDefaultApiUrl = () => {
    try {
        if (typeof window === 'undefined') return "http://localhost:3001/api";

        // 1. Check URL Query Param (?api=...)
        const params = new URLSearchParams(window.location.search);
        const override = params.get('api');
        if (override) return override.replace(/\/$/, '') + '/api';

        // 2. Check LocalStorage (Persistence)
        const cached = localStorage.getItem('doll_workflow_api_url');
        if (cached) return cached;

        // 3. Default to Localhost Standard Port
        return "http://localhost:3001/api";

    } catch (e) {
        console.error("Auto-detect failed:", e);
        return "http://localhost:3001/api";
    }
};

export default function App() {
  // --- Global State ---
  // API Endpoint State (Loaded from auto-detect or local storage)
  const [apiEndpoint, setApiEndpoint] = useState<string>(detectDefaultApiUrl());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  
  // UI State
  const [lightboxImage, setLightboxImage] = useState<ImageItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [activePromptSection, setActivePromptSection] = useState<'hairstyle' | 'assembly' | 'replacement' | null>(null);

  // Data State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // Image State Categories
  const [hairRefImages, setHairRefImages] = useState<ImageItem[]>([]);
  const [hairMannequinImages, setHairMannequinImages] = useState<ImageItem[]>([]);
  const [hairOutputImages, setHairOutputImages] = useState<ImageItem[]>([]);
  
  const [assemblyHairImages, setAssemblyHairImages] = useState<ImageItem[]>([]);
  const [assemblyBodyImages, setAssemblyBodyImages] = useState<ImageItem[]>([]);
  const [assemblyClothImages, setAssemblyClothImages] = useState<ImageItem[]>([]);
  const [assemblyOutputImages, setAssemblyOutputImages] = useState<ImageItem[]>([]);

  const [replaceRefImages, setReplaceRefImages] = useState<ImageItem[]>([]);
  const [replaceProdImages, setReplaceProdImages] = useState<ImageItem[]>([]);
  const [replaceOutputImages, setReplaceOutputImages] = useState<ImageItem[]>([]);

  // Refs for polling interval cleanup
  const pollIntervalRef = useRef<any>(null);

  // --- Helpers ---

  // Update API Endpoint and persist
  const updateApiEndpoint = (newUrl: string) => {
    // Remove trailing /api if user added it, we append it cleanly
    const cleanUrl = newUrl.replace(/\/api\/?$/, '') + '/api';
    setApiEndpoint(cleanUrl);
    localStorage.setItem('doll_workflow_api_url', cleanUrl);
    addLog('INFO', `API Endpoint manually updated to: ${cleanUrl}`);
    setConnectionStatus('checking'); // Trigger re-check
    // Reset tasks/images slightly to avoid stale data confusion
    setTasks([]); 
    fetchData(); 
  };

  const getApiBase = () => apiEndpoint.replace(/\/api\/?$/, '');

  const resolveImageUrl = useCallback((img: ImageItem): ImageItem => {
    if (!img || !img.url) return img;
    if (img.url.startsWith('http') || img.url.startsWith('blob:') || img.url.startsWith('data:')) {
        return img;
    }
    const cleanPath = img.url.startsWith('/') ? img.url : `/${img.url}`;
    const base = getApiBase();
    return { ...img, url: `${base}${cleanPath.replace(/^\/files/, '')}`.replace('/api/', '/') };
  }, [apiEndpoint]);

  const addLog = useCallback((level: 'INFO' | 'WARN' | 'ERROR', message: string) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    };
    setLogs(prev => [...prev, newLog]);
  }, []);

  // Helper to merge new data from server with local selection state
  // This prevents selection from being cleared when polling updates
  const mergePreservingSelection = (prevItems: ImageItem[], newItems: ImageItem[]) => {
      const selectedIds = new Set(prevItems.filter(i => i.selected).map(i => i.id));
      return newItems.map(item => ({
          ...item,
          selected: selectedIds.has(item.id)
      }));
  };

  // --- API Integrations ---

  const fetchData = useCallback(async () => {
    if (!apiEndpoint) return;

    try {
        // 1. Config
        const resConfig = await axios.get(`${apiEndpoint}/config`, { timeout: 5000 });
        setSettings(resConfig.data);
        
        if (connectionStatus !== 'connected') {
            setConnectionStatus('connected');
            addLog('INFO', `Connected to Backend: ${apiEndpoint}`);
        }

        // 2. Tasks
        const resTasks = await axios.get(`${apiEndpoint}/tasks`);
        
        // Helper to resolve image paths
        const resolveImg = (img: ImageItem) => {
             if (!img.url) return img;
             if (img.url.startsWith('http')) return img;
             let base = apiEndpoint.replace(/\/api$/, ''); 
             return { ...img, url: `${base}${img.url}` };
        };

        const fetchedTasks: TaskItem[] = resTasks.data || [];
        const resolvedTasks = fetchedTasks.map(t => ({
            ...t,
            outputImages: (t.outputImages || []).map(resolveImg),
            inputImages: (t.inputImages || []).map(resolveImg)
        }));
        setTasks(resolvedTasks);
        
        // Distribute outputs
        const newHairOut: ImageItem[] = [];
        const newAsmOut: ImageItem[] = [];
        const newRepOut: ImageItem[] = [];
        resolvedTasks.forEach(t => {
            if(t.status === 'completed' && t.outputImages) {
                 if (t.type === "HAIRSTYLE EXTRACTION") newHairOut.push(...t.outputImages);
                 else if (t.type === "DOLL ASSEMBLY") newAsmOut.push(...t.outputImages);
                 else if (t.type === "DOLL REPLACEMENT") newRepOut.push(...t.outputImages);
            }
        });
        
        // Update Output Images with Selection Preservation
        setHairOutputImages(prev => mergePreservingSelection(prev, newHairOut));
        setAssemblyOutputImages(prev => mergePreservingSelection(prev, newAsmOut));
        setReplaceOutputImages(prev => mergePreservingSelection(prev, newRepOut));

        // 3. Images
        const resImages = await axios.get(`${apiEndpoint}/images`);
        const allImages: ImageItem[] = (resImages.data || []).map(resolveImg);
        
        // Update Input Images with Selection Preservation
        setHairRefImages(prev => mergePreservingSelection(prev, allImages.filter(i => i.category === 'hair-ref')));
        setHairMannequinImages(prev => mergePreservingSelection(prev, allImages.filter(i => i.category === 'hair-mannequin')));
        setAssemblyHairImages(prev => mergePreservingSelection(prev, allImages.filter(i => i.category === 'asm-hair')));
        setAssemblyBodyImages(prev => mergePreservingSelection(prev, allImages.filter(i => i.category === 'asm-body')));
        setAssemblyClothImages(prev => mergePreservingSelection(prev, allImages.filter(i => i.category === 'asm-cloth')));
        setReplaceRefImages(prev => mergePreservingSelection(prev, allImages.filter(i => i.category === 'rep-ref')));
        setReplaceProdImages(prev => mergePreservingSelection(prev, allImages.filter(i => i.category === 'rep-prod')));

    } catch (error: any) {
        setConnectionStatus('disconnected');
        console.warn("Fetch failed:", error.message);
    }
  }, [apiEndpoint, connectionStatus, addLog]);

  // Initial Load & Polling Effect
  useEffect(() => {
    fetchData();

    // Clear existing poll
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    // Setup Polling
    pollIntervalRef.current = setInterval(() => {
        // If disconnected, pause heavy polling, just ping lightly
        if (connectionStatus === 'disconnected') {
            // Ping config endpoint to check if server is back
            axios.get(`${apiEndpoint}/config`, { timeout: 2000 })
                .then(() => {
                    setConnectionStatus('connected');
                    fetchData();
                })
                .catch(() => {});
            return;
        }

        fetchData();
    }, 5000);

    return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchData, connectionStatus, apiEndpoint]);


  // --- Action Handlers ---

  const handleUploadFile = async (file: File, category: string) => {
    if (connectionStatus === 'disconnected') {
        alert("Cannot upload: Backend disconnected. Check settings.");
        setIsSettingsOpen(true);
        return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    try {
        const res = await axios.post(`${apiEndpoint}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        // Helper to resolve immediately for UI
        const resolveImg = (img: ImageItem) => {
             if (!img.url) return img;
             if (img.url.startsWith('http')) return img;
             let base = apiEndpoint.replace(/\/api$/, '');
             return { ...img, url: `${base}${img.url}` };
        };

        const newImg: ImageItem = resolveImg(res.data);
        
        // Optimistic UI Update helpers
        const updateMap: Record<string, React.Dispatch<React.SetStateAction<ImageItem[]>>> = {
            'hair-ref': setHairRefImages,
            'hair-mannequin': setHairMannequinImages,
            'asm-hair': setAssemblyHairImages,
            'asm-body': setAssemblyBodyImages,
            'asm-cloth': setAssemblyClothImages,
            'rep-ref': setReplaceRefImages,
            'rep-prod': setReplaceProdImages
        };
        // For optimistic upload, we default selected to false anyway, and since we are appending to prev, 
        // standard state update is fine. Selection preservation is handled in fetchData polling.
        if (updateMap[category]) updateMap[category](prev => [newImg, ...prev]);
        
        addLog('INFO', `Uploaded ${file.name}`);
    } catch (e: any) {
        addLog('ERROR', `Upload failed: ${e.message}`);
        alert(`Upload Failed: ${e.message}`);
    }
  };

  const handleDeleteImages = async (itemsToDelete: ImageItem[], category: string) => {
    if (connectionStatus === 'disconnected') return;
    const updateState = (setter: React.Dispatch<React.SetStateAction<ImageItem[]>>) => {
        setter(prev => prev.filter(img => !itemsToDelete.some(d => d.id === img.id)));
    };

    if (category === 'hair-ref') updateState(setHairRefImages);
    else if (category === 'hair-mannequin') updateState(setHairMannequinImages);
    else if (category === 'asm-hair') updateState(setAssemblyHairImages);
    else if (category === 'asm-body') updateState(setAssemblyBodyImages);
    else if (category === 'asm-cloth') updateState(setAssemblyClothImages);
    else if (category === 'rep-ref') updateState(setReplaceRefImages);
    else if (category === 'rep-prod') updateState(setReplaceProdImages);

    for (const img of itemsToDelete) {
        try {
            await axios.delete(`${apiEndpoint}/images/${img.id}`);
            addLog('INFO', `Deleted image: ${img.name}`);
        } catch (e: any) {
            addLog('ERROR', `Failed to delete ${img.name}: ${e.message}`);
        }
    }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    try {
        await axios.post(`${apiEndpoint}/config`, newSettings);
        setSettings(newSettings);
        addLog('INFO', 'Configuration saved.');
    } catch (e: any) {
        addLog('ERROR', `Failed to save config: ${e.message}`);
        alert("Failed to save config. Is backend connected?");
    }
  };

  const handleSavePrompt = async (newPromptText: string) => {
    if (!activePromptSection) return;
    let updatedSettings = { ...settings };
    if (activePromptSection === 'hairstyle') updatedSettings.promptHairstyle = newPromptText;
    else if (activePromptSection === 'assembly') updatedSettings.promptAssembly = newPromptText;
    else if (activePromptSection === 'replacement') updatedSettings.promptReplacement = newPromptText;
    
    await handleSaveSettings(updatedSettings);
    setActivePromptSection(null);
  };

  const getActivePromptInitialValue = () => {
    if (activePromptSection === 'hairstyle') return settings.promptHairstyle;
    if (activePromptSection === 'assembly') return settings.promptAssembly;
    if (activePromptSection === 'replacement') return settings.promptReplacement;
    return "";
  };

  const getActivePromptTitle = () => {
    if (activePromptSection === 'hairstyle') return "Hairstyle Extraction";
    if (activePromptSection === 'assembly') return "Doll Assembly";
    if (activePromptSection === 'replacement') return "Doll Replacement";
    return "";
  };

  const handleGenerate = async (stage: WorkflowStage, model: string, size: string, aspectRatio: string, selectedInputs: ImageItem[]) => {
    if (connectionStatus === 'disconnected') {
        alert("Backend disconnected. Please check if the server is running on port 3001.");
        setIsSettingsOpen(true);
        return;
    }
    if (!settings.geekaiApiKey) {
        alert("Please configure API Key in settings first.");
        setIsSettingsOpen(true);
        return;
    }
    const req: GenerateRequest = { stage, model, size, aspect_ratio: aspectRatio, input_images: selectedInputs, settings };
    try {
        await axios.post(`${apiEndpoint}/generate`, req);
        addLog('INFO', `Started ${stage} task.`);
        setIsTasksOpen(true);
    } catch (e: any) {
        const msg = e.response?.data?.message || e.message;
        alert(`Failed to start generation: ${msg}`);
        addLog('ERROR', `Generation failed: ${msg}`);
    }
  };

  // Section State
  const [hairModel, setHairModel] = useState<AIModel>(AIModel.NANO_BANANA);
  const [hairSize, setHairSize] = useState<string>(MODEL_CONFIGS[AIModel.NANO_BANANA].defaultSize);
  const [hairAspectRatio, setHairAspectRatio] = useState<string>(MODEL_CONFIGS[AIModel.NANO_BANANA].defaultAspectRatio);
  const [activeHairTab, setActiveHairTab] = useState<'reference' | 'mannequin'>('reference');

  const onGenerateHair = () => {
      const ref = hairRefImages.find(i => i.selected);
      const man = hairMannequinImages.find(i => i.selected);
      if(!ref || !man) return alert("Select 1 Reference and 1 Mannequin image.");
      handleGenerate(WorkflowStage.HAIRSTYLE_EXTRACTION, hairModel, hairSize, hairAspectRatio, [ref, man]);
  };

  const [assemblyModel, setAssemblyModel] = useState<AIModel>(AIModel.NANO_BANANA);
  const [assemblySize, setAssemblySize] = useState<string>(MODEL_CONFIGS[AIModel.NANO_BANANA].defaultSize);
  const [assemblyAspectRatio, setAssemblyAspectRatio] = useState<string>(MODEL_CONFIGS[AIModel.NANO_BANANA].defaultAspectRatio);
  const [activeAssemblyTab, setActiveAssemblyTab] = useState<'hair' | 'body' | 'cloth'>('hair');

  const onGenerateAssembly = () => {
      const hair = assemblyHairImages.find(i => i.selected);
      const body = assemblyBodyImages.find(i => i.selected);
      const cloth = assemblyClothImages.find(i => i.selected);
      if(!hair || !body || !cloth) return alert("Select 1 Hair, 1 Body, and 1 Cloth image.");
      handleGenerate(WorkflowStage.DOLL_ASSEMBLY, assemblyModel, assemblySize, assemblyAspectRatio, [hair, body, cloth]);
  };

  const [replaceModel, setReplaceModel] = useState<AIModel>(AIModel.NANO_BANANA);
  const [replaceSize, setReplaceSize] = useState<string>(MODEL_CONFIGS[AIModel.NANO_BANANA].defaultSize);
  const [replaceAspectRatio, setReplaceAspectRatio] = useState<string>(MODEL_CONFIGS[AIModel.NANO_BANANA].defaultAspectRatio);
  const [activeReplaceTab, setActiveReplaceTab] = useState<'reference' | 'product'>('reference');

  const onGenerateReplace = () => {
      const ref = replaceRefImages.find(i => i.selected);
      const prod = replaceProdImages.find(i => i.selected);
      if(!ref || !prod) return alert("Select 1 Reference and 1 Product image.");
      handleGenerate(WorkflowStage.DOLL_REPLACEMENT, replaceModel, replaceSize, replaceAspectRatio, [ref, prod]);
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg shadow-sm border border-slate-100 p-1 flex items-center justify-center overflow-hidden">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                </div>
                <div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-purple-600">
                        DollWorkflow<span className="font-light text-slate-600">AI</span>
                    </h1>
                </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
                {connectionStatus === 'disconnected' && (
                    <div 
                        className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-semibold cursor-pointer hover:bg-red-100 transition-colors" 
                        onClick={() => setIsSettingsOpen(true)}
                        title="Connection Failed"
                    >
                        <Link2Off size={14} />
                        <span>Backend Disconnected</span>
                    </div>
                )}
                <div className="hidden sm:flex flex-col items-end mr-2">
                    <span className="text-xs font-semibold text-slate-700">Project Workspace</span>
                    <span className="text-[10px] text-slate-400 font-mono max-w-[150px] truncate">{settings.workingDirectory}</span>
                </div>
                <div className="h-8 w-px bg-slate-200 mx-1"></div>
                 <button onClick={() => setIsLogsOpen(true)} className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="System Logs"><FileText size={20} /></button>
                 <button onClick={() => setIsTasksOpen(true)} className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Task Queue"><List size={20} /></button>
                <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="System Settings"><Settings size={20} /></button>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">
        <SectionWrapper
            stepNumber={1}
            title="发型提取 (Hairstyle Extraction)"
            description="Upload source images to extract hairstyle features."
            selectedModel={hairModel}
            onModelChange={setHairModel}
            selectedSize={hairSize}
            onSizeChange={setHairSize}
            selectedAspectRatio={hairAspectRatio}
            onAspectRatioChange={setHairAspectRatio}
            onPromptClick={() => setActivePromptSection('hairstyle')}
            onGenerate={onGenerateHair}
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
                <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex border-b border-slate-100 bg-slate-50">
                        <button onClick={() => setActiveHairTab('reference')} className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeHairTab === 'reference' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><Scissors size={16} /> 发型参考</button>
                        <button onClick={() => setActiveHairTab('mannequin')} className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeHairTab === 'mannequin' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><User size={16} /> 假人模特</button>
                    </div>
                    <div className="flex-1 p-1 overflow-hidden">
                        {activeHairTab === 'reference' && <ImageGrid title="发型参考素材" images={hairRefImages} setImages={setHairRefImages} allowUpload={true} onImageClick={setLightboxImage} onUploadFile={handleUploadFile} category="hair-ref" onDelete={(items) => handleDeleteImages(items, 'hair-ref')} />}
                        {activeHairTab === 'mannequin' && <ImageGrid title="假人模特素材" images={hairMannequinImages} setImages={setHairMannequinImages} allowUpload={true} onImageClick={setLightboxImage} onUploadFile={handleUploadFile} category="hair-mannequin" onDelete={(items) => handleDeleteImages(items, 'hair-mannequin')} />}
                    </div>
                </div>
                <ImageGrid title="输出结果 (Output)" images={hairOutputImages} setImages={setHairOutputImages} allowUpload={false} onImageClick={setLightboxImage} />
            </div>
        </SectionWrapper>

        <SectionWrapper
            stepNumber={2}
            title="娃娃组装 (Doll Assembly)"
            description="Combine Hairstyle, Body, and Clothes to assemble the doll."
            selectedModel={assemblyModel}
            onModelChange={setAssemblyModel}
            selectedSize={assemblySize}
            onSizeChange={setAssemblySize}
            selectedAspectRatio={assemblyAspectRatio}
            onAspectRatioChange={setAssemblyAspectRatio}
            onPromptClick={() => setActivePromptSection('assembly')}
            onGenerate={onGenerateAssembly}
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
                <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex border-b border-slate-100 bg-slate-50">
                        <button onClick={() => setActiveAssemblyTab('hair')} className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeAssemblyTab === 'hair' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><Scissors size={16} /> 发型</button>
                        <button onClick={() => setActiveAssemblyTab('body')} className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeAssemblyTab === 'body' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><User size={16} /> 本体</button>
                        <button onClick={() => setActiveAssemblyTab('cloth')} className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeAssemblyTab === 'cloth' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><Shirt size={16} /> 衣服</button>
                    </div>
                    <div className="flex-1 p-1 overflow-hidden">
                        {activeAssemblyTab === 'hair' && <ImageGrid title="发型素材" images={assemblyHairImages} setImages={setAssemblyHairImages} allowUpload={true} onImageClick={setLightboxImage} onUploadFile={handleUploadFile} category="asm-hair" onDelete={(items) => handleDeleteImages(items, 'asm-hair')} />}
                        {activeAssemblyTab === 'body' && <ImageGrid title="本体素材" images={assemblyBodyImages} setImages={setAssemblyBodyImages} allowUpload={true} onImageClick={setLightboxImage} onUploadFile={handleUploadFile} category="asm-body" onDelete={(items) => handleDeleteImages(items, 'asm-body')} />}
                        {activeAssemblyTab === 'cloth' && <ImageGrid title="衣服素材" images={assemblyClothImages} setImages={setAssemblyClothImages} allowUpload={true} onImageClick={setLightboxImage} onUploadFile={handleUploadFile} category="asm-cloth" onDelete={(items) => handleDeleteImages(items, 'asm-cloth')} />}
                    </div>
                </div>
                <ImageGrid title="组装结果 (Output)" images={assemblyOutputImages} setImages={setAssemblyOutputImages} allowUpload={false} onImageClick={setLightboxImage} />
            </div>
        </SectionWrapper>

        <SectionWrapper
            stepNumber={3}
            title="娃娃替换 (Doll Replacement)"
            description="Replace specific elements using Reference and Product images."
            selectedModel={replaceModel}
            onModelChange={setReplaceModel}
            selectedSize={replaceSize}
            onSizeChange={setReplaceSize}
            selectedAspectRatio={replaceAspectRatio}
            onAspectRatioChange={setReplaceAspectRatio}
            onPromptClick={() => setActivePromptSection('replacement')}
            onGenerate={onGenerateReplace}
        >
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
                <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex border-b border-slate-100 bg-slate-50">
                        <button onClick={() => setActiveReplaceTab('reference')} className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeReplaceTab === 'reference' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><Copy size={16} /> 对标图</button>
                        <button onClick={() => setActiveReplaceTab('product')} className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeReplaceTab === 'product' ? 'bg-white text-blue-600 border-t-2 border-t-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><ImageIcon size={16} /> 产品图</button>
                    </div>
                    <div className="flex-1 p-1 overflow-hidden">
                        {activeReplaceTab === 'reference' && <ImageGrid title="对标图素材" images={replaceRefImages} setImages={setReplaceRefImages} allowUpload={true} onImageClick={setLightboxImage} onUploadFile={handleUploadFile} category="rep-ref" onDelete={(items) => handleDeleteImages(items, 'rep-ref')} />}
                        {activeReplaceTab === 'product' && <ImageGrid title="产品图素材" images={replaceProdImages} setImages={setReplaceProdImages} allowUpload={true} onImageClick={setLightboxImage} onUploadFile={handleUploadFile} category="rep-prod" onDelete={(items) => handleDeleteImages(items, 'rep-prod')} />}
                    </div>
                </div>
                <ImageGrid title="替换结果 (Output)" images={replaceOutputImages} setImages={setReplaceOutputImages} allowUpload={false} onImageClick={setLightboxImage} />
            </div>
        </SectionWrapper>
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={handleSaveSettings} 
        currentSettings={settings} 
        apiEndpoint={apiEndpoint}
        onApiEndpointChange={updateApiEndpoint}
      />
      <SystemLogsModal isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} logs={logs} />
      <TaskListModal isOpen={isTasksOpen} onClose={() => setIsTasksOpen(false)} tasks={tasks} />
      <PromptModal isOpen={!!activePromptSection} onClose={() => setActivePromptSection(null)} onSave={handleSavePrompt} title={getActivePromptTitle()} initialPrompt={getActivePromptInitialValue()} />
      <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}