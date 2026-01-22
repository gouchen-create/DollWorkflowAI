import * as fs from 'fs-extra';
import * as fsNative from 'fs'; // Use native fs for appendFile
import path from 'path';
import { AppSettings, TaskItem, ImageItem } from './types';

// Fix for missing Node types
declare var __dirname: string;

const DATA_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const IMAGES_FILE = path.join(DATA_DIR, 'images.json');
const LOGS_DIR = path.join(DATA_DIR, 'logs');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Ensure dirs exist
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(LOGS_DIR);

// Default initial config
const DEFAULT_CONFIG: AppSettings = {
  geekaiApiKey: "",
  concurrency: 4,
  workingDirectory: "./output",
  ossAccessKeyId: "",
  ossAccessKeySecret: "",
  ossEndpoint: "",
  ossBucketName: "",
  ossFolder: "doll-workflow/",
  promptHairstyle: "",
  promptAssembly: "",
  promptReplacement: ""
};

// Simple Mutex to prevent race conditions on JSON files
class Mutex {
  private queue: Promise<void> = Promise.resolve();
  
  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.then(() => {}).catch(() => {});
    return result;
  }
}

const dbMutex = new Mutex();

export class DB {
  // --- Startup Recovery Logic ---
  // Call this ONLY once when server starts
  static async recoverState(): Promise<void> {
    return dbMutex.run(async () => {
      try {
        if (!fs.existsSync(TASKS_FILE)) return;
        const tasks: TaskItem[] = await fs.readJSON(TASKS_FILE);
        let modified = false;
        
        const safeTasks = tasks.map((t: TaskItem) => {
          // If server just started and found a task labeled "processing", 
          // it effectively crashed or was stopped during that task. Mark it failed.
          if (t.status === 'processing' || t.status === 'pending') {
            modified = true;
            return { 
              ...t, 
              status: 'failed', 
              endTime: new Date().toLocaleString(), 
              error_message: 'System restarted during execution (Check logs for details)' 
            } as TaskItem;
          }
          return t;
        });

        if (modified) {
          await fs.writeJSON(TASKS_FILE, safeTasks, { spaces: 2 });
          console.log("Startup Recovery: Marked interrupted tasks as failed.");
        }
      } catch (error) {
        console.error("Recovery failed:", error);
      }
    });
  }

  static async getConfig(): Promise<AppSettings> {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
          // Fallback to old path if needed or create new
          const oldPath = path.join(__dirname, 'data.json');
          if (fs.existsSync(oldPath)) {
             const oldData = await fs.readJSON(oldPath);
             await fs.writeJSON(CONFIG_FILE, oldData, { spaces: 2 });
             return { ...DEFAULT_CONFIG, ...oldData };
          }
          await fs.writeJSON(CONFIG_FILE, DEFAULT_CONFIG, { spaces: 2 });
          return DEFAULT_CONFIG;
        }
        return { ...DEFAULT_CONFIG, ...await fs.readJSON(CONFIG_FILE) };
    } catch (error) {
        console.error("Error reading config, returning default:", error);
        return DEFAULT_CONFIG;
    }
  }

  static async saveConfig(config: AppSettings): Promise<void> {
    return dbMutex.run(async () => {
        try {
            await fs.writeJSON(CONFIG_FILE, config, { spaces: 2 });
        } catch (error) {
            console.error("Error saving config:", error);
        }
    });
  }

  // --- Tasks ---

  static async getTasks(): Promise<TaskItem[]> {
    return dbMutex.run(async () => {
        try {
            if (!fs.existsSync(TASKS_FILE)) return [];
            const tasks: TaskItem[] = await fs.readJSON(TASKS_FILE);
            
            // Hydrate logs from external files
            // DO NOT modify status here. Read-only operation.
            const hydratedTasks = await Promise.all(tasks.map(async (t) => {
                const logPath = path.join(LOGS_DIR, `${t.id}.log`);
                if (await fs.pathExists(logPath)) {
                    const logContent = await fs.readFile(logPath, 'utf8');
                    const fileLogs = logContent.split('\n').filter(line => line.trim().length > 0);
                    return { ...t, logs: fileLogs };
                }
                return t;
            }));

            return hydratedTasks;
        } catch (error) {
            console.error("Error reading tasks:", error);
            return [];
        }
    });
  }

  static async saveTasks(tasks: TaskItem[]): Promise<void> {
    try {
        await fs.writeJSON(TASKS_FILE, tasks, { spaces: 2 });
    } catch (error) {
        console.error("Error saving tasks:", error);
    }
  }

  static async addTask(task: TaskItem): Promise<void> {
    return dbMutex.run(async () => {
        let tasks = [];
        if (fs.existsSync(TASKS_FILE)) {
             tasks = await fs.readJSON(TASKS_FILE);
        }
        tasks.unshift(task);
        await fs.writeJSON(TASKS_FILE, tasks, { spaces: 2 });
    });
  }

  static async updateTask(taskId: string, updates: Partial<TaskItem>): Promise<void> {
    return dbMutex.run(async () => {
        if (!fs.existsSync(TASKS_FILE)) return;
        const tasks: TaskItem[] = await fs.readJSON(TASKS_FILE);
        const index = tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            await fs.writeJSON(TASKS_FILE, tasks, { spaces: 2 });
        }
    });
  }

  // Optimized Logging: Appends to file immediately
  static async addTaskLog(taskId: string, message: string): Promise<void> {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logLine = `[${timestamp}] ${message}\n`;
    const logPath = path.join(LOGS_DIR, `${taskId}.log`);

    try {
        await new Promise<void>((resolve, reject) => {
            fsNative.appendFile(logPath, logLine, { encoding: 'utf8' }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } catch (e) {
        console.error(`Failed to write log for ${taskId}:`, e);
    }
  }

  // --- Images ---

  static async getImages(): Promise<ImageItem[]> {
    return dbMutex.run(async () => {
        try {
            if (!fs.existsSync(IMAGES_FILE)) return [];
            return await fs.readJSON(IMAGES_FILE);
        } catch (error) {
            console.error("Error reading images:", error);
            return [];
        }
    });
  }

  static async addImage(image: ImageItem): Promise<void> {
    return dbMutex.run(async () => {
        let images = [];
        if (fs.existsSync(IMAGES_FILE)) {
            images = await fs.readJSON(IMAGES_FILE);
        }
        images.unshift(image);
        await fs.writeJSON(IMAGES_FILE, images, { spaces: 2 });
    });
  }

  static async deleteImage(id: string): Promise<boolean> {
    return dbMutex.run(async () => {
        if (!fs.existsSync(IMAGES_FILE)) return false;
        const images: ImageItem[] = await fs.readJSON(IMAGES_FILE);
        const index = images.findIndex(img => img.id === id);
        if (index === -1) return false;

        const img = images[index];
        images.splice(index, 1);
        
        await fs.writeJSON(IMAGES_FILE, images, { spaces: 2 });

        try {
            if (img.local_path && await fs.pathExists(img.local_path)) {
                await fs.remove(img.local_path);
            }
        } catch (err) {
            console.error("Error deleting file from disk:", err);
        }
        return true;
    });
  }
}