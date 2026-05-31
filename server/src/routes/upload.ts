import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// ─── Storage setup ───────────────────────────────────────────────────────────
// Files land in ./uploads at the project root. Created on demand. Each file
// gets a random 16-byte hex name + its original extension.

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 6);
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB — fine for images, OK for short videos
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image/* and video/* files are allowed'));
    }
  },
});

// ─── POST /api/upload ────────────────────────────────────────────────────────
// Field name: "file". Returns { url, kind, size, mime }.
// Vendors only — buyers don't need to upload anything.

router.post(
  '/upload',
  authenticateToken,
  requireRole('VENDOR', 'ADMIN'),
  (req: Request, res: Response, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        res.status(400).json({ message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: 'No file uploaded.' });
        return;
      }
      // Public path — server mounts /uploads as static in index.ts
      const url = `/uploads/${req.file.filename}`;
      res.status(201).json({
        url,
        kind: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
        size: req.file.size,
        mime: req.file.mimetype,
      });
    });
  },
);

export default router;
