import express from "express";
import {
  createBanner,
  getBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
} from "../controllers/banner.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { isSuperAdmin } from "../middlewares/role.middleware.js";
import { upload } from "../config/multer.js";

const bannerRoute = express.Router();

/* ADMIN */
bannerRoute.post(
  "/",
  upload.single("image"),
  createBanner
);

bannerRoute.put(
  "/:id",
  protect,
  isSuperAdmin,
  upload.array("images", 5),
  updateBanner
);


bannerRoute.delete(
  "/:id",
  protect,
  isSuperAdmin,
  deleteBanner
);


/* PUBLIC */
bannerRoute.get("/", getBanners);
bannerRoute.get("/:id", getBannerById);

export default bannerRoute;