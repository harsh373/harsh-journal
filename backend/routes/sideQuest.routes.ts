import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  createSideQuest,
  deleteQuestCover,
  deleteSideQuest,
  getSideQuest,
  listSideQuests,
  updateSideQuest,
  uploadQuestCover,
} from "../controller/sideQuest.controller";
import {
  createPost,
  deletePost,
  deletePostPhoto,
  listPosts,
  updatePost,
  uploadPostPhoto,
} from "../controller/sideQuestPost.controller";
import { photoUpload } from "../utility/upload";

const router = Router();

function withUpload(req: Request, res: Response, next: NextFunction) {
  photoUpload(req, res, (error: unknown) => {
    if (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Upload failed" });
      return;
    }
    next();
  });
}

router.get("/", listSideQuests);
router.post("/", createSideQuest);
router.get("/:id", getSideQuest);
router.put("/:id", updateSideQuest);
router.delete("/:id", deleteSideQuest);

router.post("/:id/cover", withUpload, uploadQuestCover);
router.delete("/:id/cover", deleteQuestCover);

router.get("/:id/posts", listPosts);
router.post("/:id/posts", createPost);
router.put("/:id/posts/:postId", updatePost);
router.delete("/:id/posts/:postId", deletePost);
router.post("/:id/posts/:postId/photos", withUpload, uploadPostPhoto);
router.delete("/:id/posts/:postId/photos/:photoId", deletePostPhoto);

export default router;