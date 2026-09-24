import multer from "multer";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB, before client-side compression usually shrinks it further
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// Files land in memory, not on disk, since we stream straight to Cloudinary.
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new Error("Only JPEG, PNG, WEBP or HEIC images are allowed"));
      return;
    }
    callback(null, true);
  },
}).single("photo");