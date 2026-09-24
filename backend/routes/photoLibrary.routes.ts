import { Router } from "express";
import { listPhotoLibrary } from "../controller/photoLibrary.controller";

const router = Router();

router.get("/", listPhotoLibrary);

export default router;