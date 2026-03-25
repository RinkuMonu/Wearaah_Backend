import multer from "multer";
import fs from "fs";
import path from "path";

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only images & PDFs allowed"), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 2MB
});


export const deleteLocalFile = (filePath) => {
  if (!filePath) return;

  const fullPath = path.join(process.cwd(), filePath);

  fs.unlink(fullPath, (err) => {
    if (err) {
      console.warn("⚠️ Failed to delete file:", err);
    } else {
      console.log("🗑️ Deleted old file:", err);
    }
  });
};
