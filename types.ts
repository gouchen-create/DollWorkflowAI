
export interface ImageItem {
  id: string;
  url: string;
  name: string;
  selected: boolean;
  category?: string; // For multi-category sections
}

export enum AIModel {
  DOUBAO_SEEDREAM_4_0 = "doubao-seedream-4.0",
  DOUBAO_SEEDREAM_4_5 = "doubao-seedream-4.5",
  JIMENG_T2I_V40 = "jimeng_t2i_v40",
  NANO_BANANA_HD = "nano-banana-hd",
  NANO_BANANA = "nano-banana",
  NANO_BANANA_2 = "nano-banana-2",
}

export const MODEL_CONFIGS = {
  [AIModel.DOUBAO_SEEDREAM_4_5]: {
    aspectRatios: ["Auto", "1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
    sizes: ["2K", "4K"],
    defaultSize: "2K",
    defaultAspectRatio: "Auto"
  },
  [AIModel.DOUBAO_SEEDREAM_4_0]: {
    aspectRatios: ["Auto", "1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
    sizes: ["1K", "2K", "4K"],
    defaultSize: "1K",
    defaultAspectRatio: "Auto"
  },
  [AIModel.JIMENG_T2I_V40]: {
    aspectRatios: ["Auto", "1:1", "4:3", "16:9", "3:2", "21:9"],
    sizes: ["1K", "2K", "4K"],
    defaultSize: "1K",
    defaultAspectRatio: "Auto"
  },
  [AIModel.NANO_BANANA_HD]: {
    aspectRatios: ["Auto", "1:1", "2:3", "3:2", "4:3", "3:4", "4:5", "5:4", "16:9", "9:16", "21:9"],
    sizes: ["4K"],
    defaultSize: "4K",
    defaultAspectRatio: "Auto"
  },
  [AIModel.NANO_BANANA]: {
    aspectRatios: ["Auto", "1:1", "2:3", "3:2", "4:3", "3:4", "4:5", "5:4", "16:9", "9:16", "21:9"],
    sizes: ["1K"],
    defaultSize: "1K",
    defaultAspectRatio: "Auto"
  },
  [AIModel.NANO_BANANA_2]: {
    aspectRatios: ["Auto", "1:1", "2:3", "3:2", "4:3", "3:4", "4:5", "5:4", "16:9", "9:16", "21:9"],
    sizes: ["1K", "2K", "4K"],
    defaultSize: "1K",
    defaultAspectRatio: "Auto"
  },
};

export enum WorkflowStage {
  HAIRSTYLE_EXTRACTION = "hairstyle_extraction",
  DOLL_ASSEMBLY = "doll_assembly",
  DOLL_REPLACEMENT = "doll_replacement",
}

export interface SectionProps {
  id: string;
  title: string;
  description: string;
}

export interface AppSettings {
  geekaiApiKey: string;
  concurrency: number;
  workingDirectory: string;
  // Aliyun OSS Config
  ossAccessKeyId: string;
  ossAccessKeySecret: string;
  ossEndpoint: string;
  ossBucketName: string;
  ossFolder: string;
  // Prompt Configurations
  promptHairstyle: string;
  promptAssembly: string;
  promptReplacement: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  geekaiApiKey: "",
  concurrency: 4,
  workingDirectory: "./output",
  // Aliyun OSS Config Defaults
  ossAccessKeyId: "",
  ossAccessKeySecret: "",
  ossEndpoint: "",
  ossBucketName: "",
  ossFolder: "doll-workflow/",
  // Default Prompts
  promptHairstyle: "图1是一张真实拍摄的毛绒娃娃电商产品主图，将这个产品的发型提取出来、戴在图2的假人模特头部模型上，并且给我穿戴效果的三视图白底图，一字排开，从左到右依次是背面、正面、侧面。保持图1拍摄时发型的形状、光影、材质、质感。",
  promptAssembly: "这三张图是电商毛绒玩偶的实拍三视图，图1是毛绒玩偶的发型、图2是毛绒玩偶的主体、图3是毛绒玩偶的衣服。帮我将图1发型、图3衣服组装到图2毛绒玩偶主体的效果图，最终给我穿戴效果的三视图白底图，从左到右一字排开，从左到右分别是背面、正面、侧面（朝向左侧）。",
  promptReplacement: "图2的毛绒玩偶自动融合到图1的绿色填充区域，均匀自然。"
};

// --- New Types for Logs and Tasks ---

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export type TaskStatus = 'processing' | 'completed' | 'failed';

export interface TaskItem {
  id: string;
  type: string; // e.g. "Hairstyle Extraction"
  status: TaskStatus;
  model: string;
  inputImages: ImageItem[];
  outputImages: ImageItem[];
  startTime: string;
  endTime?: string;
  duration?: string; // formatted string e.g. "4.5s"
  logs?: string[]; // Detailed execution logs
  error_message?: string;
}

export interface GenerateRequest {
  stage: WorkflowStage;
  model: string;
  size: string;
  aspect_ratio: string;
  input_images: ImageItem[];
  settings: AppSettings;
}
