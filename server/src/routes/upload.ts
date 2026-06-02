import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// ─── Cloudinary setup ────────────────────────────────────────────────────────
// We use Cloudinary in prod (Render's filesystem is ephemeral so anything
// written to ./uploads would disappear on every restart/deploy). In dev,
// leaving the env vars blank silently falls back to local disk storage.

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUD_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET;
const USE_CLOUDINARY = Boolean(CLOUD_NAME && CLOUD_KEY && CLOUD_SECRET);

if (USE_CLOUDINARY) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key:    CLOUD_KEY,
    api_secret: CLOUD_SECRET,
    secure:     true,
  });
}

// ─── Multer ──────────────────────────────────────────────────────────────────
// In Cloudinary mode the file lives in memory just long enough to stream to
// Cloudinary. In disk mode it goes to ./uploads with a random hex name.

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!USE_CLOUDINARY && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = USE_CLOUDINARY
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().slice(0, 6);
        cb(null, crypto.randomBytes(16).toString('hex') + ext);
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image/* and video/* files are allowed'));
    }
  },
});

// Streams an in-memory buffer to Cloudinary. Returns the upload response.
function uploadBufferToCloudinary(buffer: Buffer, mimetype: string): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const resourceType = mimetype.startsWith('video/') ? 'video' : 'image';
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: 'campuschoo' },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('No result from Cloudinary'));
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

// ─── POST /api/upload ────────────────────────────────────────────────────────
// Field name: "file". Returns { url, kind, size, mime }.

router.post(
  '/upload',
  authenticateToken,
  requireRole('VENDOR', 'ADMIN'),
  (req: Request, res: Response) => {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        res.status(400).json({ message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: 'No file uploaded.' });
        return;
      }

      try {
        let url: string;
        if (USE_CLOUDINARY) {
          const result = await uploadBufferToCloudinary(req.file.buffer, req.file.mimetype);
          url = result.secure_url;
        } else {
          // Local-disk fallback — server mounts /uploads as express.static.
          url = `/uploads/${req.file.filename}`;
        }
        res.status(201).json({
          url,
          kind: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
          size: req.file.size,
          mime: req.file.mimetype,
        });
      } catch (uploadErr) {
        const message = uploadErr instanceof Error ? uploadErr.message : 'Upload failed';
        res.status(502).json({ message: `Cloudinary upload failed: ${message}` });
      }
    });
  },
);

export default router;
