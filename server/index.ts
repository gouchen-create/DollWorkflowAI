import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import * as fs from 'fs-extra'; // Safer import for fs-extra
import { DB } from './db';
import { WorkflowEngine } from './workflow';
import { ImageItem, GenerateRequest } from './types';

// Fix for missing Node types
declare var process: any;
declare var __dirname: string;
declare var Buffer: any;

const app = express();
const PORT = 3001;

// Global error handler for uncaught exceptions to try and log them before dying
process.on('uncaughtException', (err: any) => {
  console.error('FATAL Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason: any, promise: any) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Setup directories structure matching DB expectations
const DATA_DIR = path.join(__dirname, 'data');
const INPUT_DIR = path.join(DATA_DIR, 'inputs');
const LOGS_DIR = path.join(DATA_DIR, 'logs');

// Ensure directories exist safely
try {
  fs.ensureDirSync(INPUT_DIR);
  fs.ensureDirSync(LOGS_DIR);
} catch (err) {
  console.error("Failed to create directories:", err);
}

// Middleware
app.use(cors({ origin: '*' }) as any); 
app.use(express.json({ limit: '50mb' }) as any);

// Initialize Engine
const engine = new WorkflowEngine();

// Serve Static Files
app.use('/files/inputs', express.static(INPUT_DIR) as any);

// Serve generic files (for outputs accessed by full path in dev)
app.get('/files/:filename', async (req: any, res: any) => {
    try {
        const filename = req.params.filename;
        const config = await DB.getConfig();

        // Check inputs first
        const inputPath = path.resolve(INPUT_DIR, filename);
        if (await fs.pathExists(inputPath)) {
            return res.sendFile(inputPath);
        }
        
        // Check config working dir for outputs (Resolve to absolute path)
        const outputDir = path.resolve(config.workingDirectory);
        const outputPath = path.resolve(outputDir, filename);

        if (await fs.pathExists(outputPath)) {
            // Security check: ensure outputPath is within outputDir to prevent traversal
            if (!outputPath.startsWith(outputDir)) {
                 return res.status(403).send("Access denied");
            }
            return res.sendFile(outputPath);
        }
        
        res.status(404).send("File not found");
    } catch (e: any) {
        console.error("File serve error:", e.message);
        res.status(500).send("Error serving file");
    }
});

// Health Check
app.get('/api/health', (req: any, res: any) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root check
app.get('/', (req: any, res: any) => {
  res.send("DollWorkflowAI Server is running");
});

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, INPUT_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage: storage });

// --- Routes ---

// 1. Config
app.get('/api/config', async (req: any, res: any) => {
  try {
    const config = await DB.getConfig();
    res.json(config);
  } catch (e: any) {
    console.error("Get Config Error:", e);
    res.status(500).json({ message: "Failed to get config" });
  }
});

app.post('/api/config', async (req: any, res: any) => {
  try {
    await DB.saveConfig(req.body);
    engine.updateConcurrency(req.body.concurrency);
    res.json({ success: true });
  } catch (e: any) {
    console.error("Save Config Error:", e);
    res.status(500).json({ message: "Failed to save config" });
  }
});

// 2. Images (Upload & List & Delete)
app.post('/api/upload', upload.single('file') as any, async (req: any, res: any) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).send("No file uploaded");
    
    const relativeUrl = `/files/inputs/${file.filename}`;
    
    const imageItem: ImageItem = {
      id: req.body.id || Date.now().toString(),
      url: relativeUrl, 
      local_path: file.path, // Store absolute path from multer
      name: Buffer.from(file.originalname, 'latin1').toString('utf8'), 
      category: req.body.category || 'uncategorized',
      selected: false
    };

    await DB.addImage(imageItem);
    res.json(imageItem);
  } catch (e: any) {
    console.error("Upload Error:", e);
    res.status(500).send(e.message);
  }
});

app.get('/api/images', async (req: any, res: any) => {
  try {
    const images = await DB.getImages();
    res.json(images);
  } catch (e: any) {
    console.error("Get Images Error:", e);
    res.status(500).json({ message: "Failed to load images" });
  }
});

app.delete('/api/images/:id', async (req: any, res: any) => {
  try {
    const success = await DB.deleteImage(req.params.id);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(404).json({ message: "Image not found" });
    }
  } catch (e: any) {
    console.error("Delete Image Error:", e);
    res.status(500).json({ message: "Failed to delete image" });
  }
});

// 3. Generate
app.post('/api/generate', async (req: any, res: any) => {
  try {
    const task = await engine.submitTask(req.body);
    res.json(task);
  } catch (e: any) {
    console.error("Generate Error:", e);
    res.status(400).json({ message: e.message });
  }
});

// 4. Tasks (History)
app.get('/api/tasks', async (req: any, res: any) => {
  try {
    const tasks = await DB.getTasks();
    res.json(tasks);
  } catch (e: any) {
    console.error("Get Tasks Error:", e);
    res.status(500).json({ message: "Failed to load tasks" });
  }
});

// Initialize DB state and Start Server
DB.recoverState().then(() => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (e) => {
    console.error("FATAL: Server failed to start:", e);
  });
});