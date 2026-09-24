import { Router } from "express";
import { deleteEntry, getEntry, listArchive, listEntries, saveEntry } from "../controller/journal.controller";
import { deleteJournalPhoto, uploadJournalPhoto } from "../controller/photo.controller";
import { photoUpload } from "../utility/upload";


const router = Router();


router.get("/", listEntries);
router.get("/archive", listArchive);
router.get("/:date", getEntry);
router.put("/:date", saveEntry);
router.delete("/:date", deleteEntry);

router.post(
  "/:date/photos",
  (req, res, next) => {
    photoUpload(req, res, (error: unknown) => {
      if (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Upload failed" });
        return;
      }
      next();
    });
  },
  uploadJournalPhoto,
);

router.delete("/:date/photos/:photoId", deleteJournalPhoto);

export default router;