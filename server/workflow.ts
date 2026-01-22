import axios from 'axios';
import OSS from 'ali-oss';
import * as fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GenerateRequest, WorkflowStage, TaskItem, ImageItem, PIXEL_MAP_2K, AppSettings } from './types';
import { DB } from './db';

// Fix for missing Node types
declare var process: any;

const GEEKAI_API_URL = "https://geekai.co/api/v1/images/generations";

export class WorkflowEngine {
  private queue: GenerateRequest[] = [];
  private activeCount: number = 0;
  private maxConcurrency: number = 4;

  constructor() {
    this.init();
  }

  async init() {
    try {
        const config = await DB.getConfig();
        this.maxConcurrency = config.concurrency || 4;
    } catch (e) {
        console.error("Workflow Engine init failed:", e);
    }
  }

  public updateConcurrency(limit: number) {
    this.maxConcurrency = limit;
    this.processQueue();
  }

  // --- Validation ---
  public validateRequest(req: GenerateRequest): string | null {
    const { settings, model, size, aspect_ratio, input_images } = req;

    if (!settings.geekaiApiKey) return "GeekAI API Key is missing. Please check Settings.";
    if (!model) return "Please select an AI Model.";
    if (!size) return "Please select a Size.";
    if (!aspect_ratio) return "Please select an Aspect Ratio.";

    const imgs = input_images;

    if (req.stage === WorkflowStage.HAIRSTYLE_EXTRACTION) {
      const ref = imgs.filter(i => i.category === 'hair-ref');
      const man = imgs.filter(i => i.category === 'hair-mannequin');
      if (ref.length !== 1 || man.length !== 1) {
        return "Rules: Select exactly 1 Reference image and 1 Mannequin image.";
      }
      // Reorder: Ref first, then Mannequin
      req.input_images = [...ref, ...man];
    } 
    else if (req.stage === WorkflowStage.DOLL_ASSEMBLY) {
      const hair = imgs.filter(i => i.category === 'asm-hair');
      const body = imgs.filter(i => i.category === 'asm-body');
      const cloth = imgs.filter(i => i.category === 'asm-cloth');
      if (hair.length !== 1 || body.length !== 1 || cloth.length !== 1) {
        return "Rules: Select exactly 1 Hair, 1 Body, and 1 Cloth image.";
      }
      req.input_images = [...hair, ...body, ...cloth];
    }
    else if (req.stage === WorkflowStage.DOLL_REPLACEMENT) {
      const ref = imgs.filter(i => i.category === 'rep-ref');
      const prod = imgs.filter(i => i.category === 'rep-prod');
      if (ref.length !== 1 || prod.length !== 1) {
        return "Rules: Select exactly 1 Reference image and 1 Product image.";
      }
      req.input_images = [...ref, ...prod];
    }

    return null;
  }

  // --- Task Submission ---
  public async submitTask(req: GenerateRequest): Promise<TaskItem> {
    const error = this.validateRequest(req);
    if (error) throw new Error(error);

    const taskId = `task-${Date.now()}-${uuidv4().substr(0, 4)}`;
    
    const newTask: TaskItem = {
      id: taskId,
      type: req.stage.replace(/_/g, ' ').toUpperCase(),
      status: 'pending',
      model: req.model,
      inputImages: req.input_images,
      outputImages: [],
      logs: [], // Init logs
      startTime: new Date().toLocaleString(),
    };

    await DB.addTask(newTask);

    // Attach ID to request for internal tracking
    (req as any)._taskId = taskId;
    
    this.queue.push(req);
    this.processQueue();

    return newTask;
  }

  // --- Queue Processor ---
  private async processQueue() {
    if (this.queue.length === 0) return;
    if (this.activeCount >= this.maxConcurrency) return;

    const req = this.queue.shift();
    if (!req) return;

    this.activeCount++;
    const taskId = (req as any)._taskId;

    // Start processing in background without blocking
    this.executeTask(taskId, req).finally(() => {
      this.activeCount--;
      this.processQueue();
    });
  }

  // --- Execution Logic ---
  private async executeTask(taskId: string, req: GenerateRequest) {
    try {
      await DB.updateTask(taskId, { status: 'processing' });
      
      // Basic System Diagnostics to catch OOM issues in logs
      const memUsage = process.memoryUsage();
      const memInfo = `RSS:${(memUsage.rss/1024/1024).toFixed(0)}MB Heap:${(memUsage.heapUsed/1024/1024).toFixed(0)}MB`;
      await DB.addTaskLog(taskId, `Task init. PID: ${process.pid}, Mem: ${memInfo}`);
      await DB.addTaskLog(taskId, `Stage: ${req.stage}, Model: ${req.model}, Size: ${req.size}, Ratio: ${req.aspect_ratio}`);

      // 1. Upload to OSS
      await DB.addTaskLog(taskId, `Starting upload of ${req.input_images.length} images to Aliyun OSS...`);
      const ossLinks = await this.uploadImagesToOSS(req.input_images, req.settings, taskId);
      await DB.addTaskLog(taskId, "OSS upload completed successfully.");
      
      // Log OSS Links
      for (let i = 0; i < ossLinks.length; i++) {
        await DB.addTaskLog(taskId, `OSS Link [${i}]: ${ossLinks[i]}`);
      }

      // 2. Construct Payload
      await DB.addTaskLog(taskId, "Constructing API payload...");
      const payload = this.constructPayload(req, ossLinks);
      
      // Detailed Payload Logging
      await DB.addTaskLog(taskId, `--- API REQUEST PAYLOAD ---`);
      await DB.addTaskLog(taskId, JSON.stringify(payload, null, 2));
      await DB.addTaskLog(taskId, `---------------------------`);

      // 3. Call GeekAI (with retry)
      await DB.addTaskLog(taskId, "Submitting task to GeekAI API...");
      const taskUuid = await this.callGeekAI(payload, req.settings.geekaiApiKey, taskId);
      await DB.updateTask(taskId, { geekai_task_id: taskUuid });
      await DB.addTaskLog(taskId, `Task submitted successfully. Remote ID: ${taskUuid}`);

      // 4. Poll Results
      await DB.addTaskLog(taskId, "Polling for results...");
      const resultUrl = await this.pollGeekAIResult(taskUuid, req.settings.geekaiApiKey, taskId);
      await DB.addTaskLog(taskId, `Image generation succeeded. Result URL: ${resultUrl}`);
      await DB.addTaskLog(taskId, "Downloading result...");

      // 5. Download Result
      const localPath = await this.downloadImage(resultUrl, req.settings.workingDirectory, taskId);
      await DB.addTaskLog(taskId, `Image saved to ${localPath}`);

      // Success
      const outputImg: ImageItem = {
        id: `out-${Date.now()}`,
        // Relative URL: /files/gen_xxx.jpg
        url: `/files/${path.basename(localPath)}`, 
        local_path: localPath,
        name: path.basename(localPath),
        selected: false
      };

      const duration = await this.calculateDuration(taskId);
      await DB.updateTask(taskId, {
        status: 'completed',
        endTime: new Date().toLocaleString(),
        duration,
        outputImages: [outputImg]
      });
      await DB.addTaskLog(taskId, `Task completed in ${duration}.`);

    } catch (error: any) {
      console.error(`Task ${taskId} failed:`, error);
      const errMsg = error.message || "Unknown error";
      // Ensure we try to log to file even if DB is locked
      await DB.addTaskLog(taskId, `CRITICAL FAILURE: ${errMsg}`);
      
      await DB.updateTask(taskId, {
        status: 'failed',
        endTime: new Date().toLocaleString(),
        error_message: errMsg
      });
    }
  }

  // --- Helpers ---

  private async calculateDuration(taskId: string): Promise<string> {
    const tasks = await DB.getTasks();
    const t = tasks.find(x => x.id === taskId);
    if (!t) return "0s";
    const start = new Date(t.startTime).getTime();
    const end = new Date().getTime();
    return `${((end - start) / 1000).toFixed(1)}s`;
  }

  private constructPayload(req: GenerateRequest, ossLinks: string[]): any {
    const { model, size, aspect_ratio, settings, stage } = req;
    
    let prompt = "";
    if (stage === WorkflowStage.HAIRSTYLE_EXTRACTION) prompt = settings.promptHairstyle;
    else if (stage === WorkflowStage.DOLL_ASSEMBLY) prompt = settings.promptAssembly;
    else if (stage === WorkflowStage.DOLL_REPLACEMENT) prompt = settings.promptReplacement;

    const payload: any = {
      model,
      image: ossLinks,
      prompt
    };

    const isAuto = aspect_ratio === "Auto";

    if (model === "doubao-seedream-4.5" || model === "doubao-seedream-4.0") {
      if (size === "2K") {
        payload.size = !isAuto ? (PIXEL_MAP_2K[aspect_ratio] || "2048x2048") : "2K";
      } else {
        // 4K or 1K
        payload.size = size;
        if (!isAuto) {
          payload.prompt = `${prompt} --ratio ${aspect_ratio}`;
        }
      }
    } 
    else if (model === "nano-banana-hd" || model === "nano-banana") {
      if (!isAuto) payload.aspect_ratio = aspect_ratio;
      // No size param
    }
    else if (model === "nano-banana-2") {
      payload.size = size;
      if (!isAuto) payload.aspect_ratio = aspect_ratio;
    }
    else {
      // Default fallback
      payload.size = size;
    }

    return payload;
  }

  private async uploadImagesToOSS(images: ImageItem[], settings: AppSettings, taskId: string): Promise<string[]> {
    if (!settings.ossAccessKeyId || !settings.ossBucketName) {
      throw new Error("OSS Configuration incomplete");
    }

    const client = new OSS({
      region: settings.ossEndpoint.split('.')[0], // simplified parsing, user usually provides full endpoint
      accessKeyId: settings.ossAccessKeyId,
      accessKeySecret: settings.ossAccessKeySecret,
      bucket: settings.ossBucketName,
      endpoint: settings.ossEndpoint,
      secure: true,
    });

    const links: string[] = [];

    for (const img of images) {
        const key = `${settings.ossFolder.replace(/\/$/, '')}/${path.basename(img.local_path)}`;
        let success = false;
        
        // Retry 3 times, 3s interval
        for (let i = 0; i < 3; i++) {
            try {
                await DB.addTaskLog(taskId, `Uploading ${img.name} (Attempt ${i+1}/3)...`);
                await client.put(key, img.local_path, { timeout: 60000 });
                // Construct URL
                let ep = settings.ossEndpoint.replace(/^https?:\/\//, '');
                links.push(`https://${settings.ossBucketName}.${ep}/${key}`);
                success = true;
                break;
            } catch (e: any) {
                await DB.addTaskLog(taskId, `Upload attempt ${i+1} failed: ${e.message}`);
                if (i === 2) throw new Error(`OSS Upload Failed for ${img.name}: ${e.message}`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
    return links;
  }

  private async callGeekAI(payload: any, apiKey: string, taskId: string): Promise<string> {
    for (let i = 0; i < 3; i++) {
        try {
            const res = await axios.post(GEEKAI_API_URL, payload, {
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 600000 // 600s timeout
            });
            
            await DB.addTaskLog(taskId, `API Response Status: ${res.status}`);
            
            if (res.status === 200 && res.data.task_id) {
                return res.data.task_id;
            }
            throw new Error(`API returned ${res.status}: ${JSON.stringify(res.data)}`);
        } catch (e: any) {
             const errMsg = e.response?.data?.message || e.message;
             await DB.addTaskLog(taskId, `GeekAI API Call Attempt ${i+1} Failed: ${errMsg}`);
             if (e.response && e.response.data) {
                 await DB.addTaskLog(taskId, `API Error Response Data: ${JSON.stringify(e.response.data, null, 2)}`);
             }
             if (i === 2) throw new Error(`GeekAI Request Failed: ${errMsg}`);
             await new Promise(r => setTimeout(r, 10000)); // 10s wait
        }
    }
    throw new Error("GeekAI Unreachable");
  }

  private async pollGeekAIResult(taskId: string, apiKey: string, dbTaskId: string): Promise<string> {
    const url = `https://geekai.co/api/v1/images/${taskId}`;
    let pollCount = 0;
    while (true) {
        await new Promise(r => setTimeout(r, 3000)); // 3s polling
        pollCount++;
        try {
            const res = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                timeout: 30000
            });
            
            const status = res.data.task_status;
            if (pollCount % 10 === 0) {
               await DB.addTaskLog(dbTaskId, `Polling... Current Status: ${status}`);
            }

            if (status === 'succeed') {
                return res.data.data[0].url;
            } else if (status === 'failed') {
                const failureMsg = res.data.error?.message || "Task failed remotely";
                await DB.addTaskLog(dbTaskId, `Remote Task Failed: ${failureMsg}`);
                throw new Error(failureMsg);
            }
            // pending or running, continue
        } catch (e: any) {
            // Check if it is a fatal error or network glitch
            if (e.response && e.response.status >= 400 && e.response.status < 500) {
                const errMsg = e.response.data?.message || "API Error";
                await DB.addTaskLog(dbTaskId, `Polling Fatal Error: ${errMsg}`);
                throw new Error(errMsg);
            }
            // Network glitch, continue polling
            console.warn("Polling glitch, retrying...", e.message);
        }
    }
  }

  private async downloadImage(url: string, saveDir: string, taskId: string): Promise<string> {
    await fs.ensureDir(saveDir);
    const fileName = `gen_${Date.now()}_${path.basename(url.split('?')[0])}`;
    // Resolve absolute path
    const filePath = path.resolve(saveDir, fileName);

    // Infinite retry, 3s interval, 30s timeout per request
    while (true) {
        try {
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                timeout: 30000
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            return filePath;
        } catch (e: any) {
            await DB.addTaskLog(taskId, `Download failed (retrying): ${e.message}`);
            console.warn("Download failed, retrying...", e);
            await new Promise(r => setTimeout(r, 3000));
        }
    }
  }
}
