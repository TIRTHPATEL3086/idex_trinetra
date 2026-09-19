import multer from 'multer';
import { env } from '../lib/env.js';
import { unsupportedMedia } from '../lib/errors.js';

/**
 * Multer with MEMORY storage — no disk writes. Buffers go straight into A's
 * core functions, which is also why nothing sensitive ever lands in a temp dir.
 */

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'application/pdf',
]);

export const ALLOWED_MIME_LIST = [...ALLOWED_MIME];

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  cb(
    unsupportedMedia(
      `"${file.mimetype}" is not a supported image type. ` +
        `Allowed: ${ALLOWED_MIME_LIST.join(', ')}.`
    )
  );
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter,
});

/** `upload.single('file')` for the two multipart routes. */
export const singleFile = upload.single('file');
