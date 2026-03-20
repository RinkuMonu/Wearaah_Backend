import express from "express";
import {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
    getCategoriesOnlyIdName
} from "../controllers/category.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { isSuperAdmin } from "../middlewares/role.middleware.js";
import { upload } from "../config/multer.js";

const categoryRoute = express.Router();

/* ADMIN */
categoryRoute.post(
    "/",
    protect,
    isSuperAdmin,
    upload.fields([
        { name: "bannerimage", maxCount: 1 },
        { name: "smallimage", maxCount: 1 }
    ]),
    createCategory
);
/* PUBLIC */
categoryRoute.get("/", getCategories);
categoryRoute.get("/nameonly", getCategoriesOnlyIdName);

categoryRoute.get("/:id", getCategoryById);


categoryRoute.put(
    "/:id",
    protect,
    isSuperAdmin,
    upload.fields([
        { name: "bannerimage", maxCount: 1 },
        { name: "smallimage", maxCount: 1 }
    ]),
    updateCategory
);

categoryRoute.delete(
    "/:id",
    protect,
    isSuperAdmin,
    deleteCategory
);

export default categoryRoute;
