import { Router } from "express";
import {
  createThought,
  deleteThought,
  getThought,
  listThoughts,
  reorderThoughts,
  updateThought,
} from "../controller/thought.controller";

const router = Router();

router.get("/", listThoughts);
router.post("/", createThought);
// Must come before "/:id" so "order" isn't read as an id.
router.put("/order", reorderThoughts);
router.get("/:id", getThought);
router.patch("/:id", updateThought);
router.delete("/:id", deleteThought);

export default router;