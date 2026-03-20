import express from "express";
import {
    createBrand,
    getBrands,
    getSingleBrand,
    updateBrand,
    deleteBrand,
    changeBrandStatus,
    getBrandsNameID,
} from "../controllers/brand.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { isSuperAdmin } from "../middlewares/role.middleware.js";
import { upload } from "../config/multer.js";

const brandRoute = express.Router();

brandRoute.post("/", protect, isSuperAdmin, upload.single("logo"), createBrand);

brandRoute.get("/", protect, getBrands);
brandRoute.get("/nameonly", protect, getBrandsNameID);

brandRoute.get("/:id", getSingleBrand);

brandRoute.put("/:id", protect, isSuperAdmin, upload.single("logo"), updateBrand);

brandRoute.delete("/:id", protect, isSuperAdmin, deleteBrand);

brandRoute.patch(
    "/status/:id",
    protect,
    isSuperAdmin,
    changeBrandStatus
);

export default brandRoute;
