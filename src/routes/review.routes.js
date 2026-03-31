import express from "express";
import {
  createReview,
  deleteReview,
  getReviewsByVariant,
  toggleReaction,
  updateReview,
} from "../controllers/review.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { isSuperAdmin } from "../middlewares/role.middleware.js";
import { upload } from "../config/multer.js";

const reviewRoute = express.Router();

/* USER */
reviewRoute.post(
  "/",
  protect,
  upload.array("rvImages", 5),
  createReview
);

reviewRoute.post("/like/:reviewId", protect, toggleReaction);
reviewRoute.get("/", getReviewsByVariant);
reviewRoute.put("/update/:reviewId", protect, updateReview);
reviewRoute.delete("/delete/:reviewId", protect, deleteReview);

export default reviewRoute;
