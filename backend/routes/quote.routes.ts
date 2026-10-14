import { Router } from "express";
import { createQuote, deleteQuote, listQuotes, updateQuote } from "../controller/quote.controller";

const router = Router();

router.get("/", listQuotes);
router.post("/", createQuote);
router.put("/:id", updateQuote);
router.delete("/:id", deleteQuote);

export default router;