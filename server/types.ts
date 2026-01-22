
export enum WorkflowStage {
  HAIRSTYLE_EXTRACTION = "hairstyle_extraction",
  DOLL_ASSEMBLY = "doll_assembly",
  DOLL_REPLACEMENT = "doll_replacement",
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

export interface ImageItem {
  id: string;
  url: string;
  local_path: string;
  name: string;
  category?: string;
  selected?: boolean;
}

export interface TaskItem {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  model: string;
  inputImages: ImageItem[];
  outputImages: ImageItem[];
  startTime: string;
  endTime?: string;
  duration?: string;
  geekai_task_id?: string;
  error_message?: string;
  logs?: string[]; // Detailed logs
}

export interface GenerateRequest {
  stage: WorkflowStage;
  model: string;
  size: string;
  aspect_ratio: string;
  input_images: ImageItem[];
  // The frontend sends the full settings object to ensure backend uses latest config
  settings: AppSettings;
}

export const PIXEL_MAP_2K: Record<string, string> = {
  "1:1": "2048x2048", "4:3": "2304x1728", "3:4": "1728x2304",
  "16:9": "2560x1440", "9:16": "1440x2560", "3:2": "2496x1664",
  "2:3": "1664x2496", "21:9": "3024x1296"
};
