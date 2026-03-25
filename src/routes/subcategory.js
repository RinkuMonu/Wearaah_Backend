import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { isSuperAdmin } from "../middlewares/role.middleware.js";
import { upload } from "../config/multer.js";
import { getSubCategoriesByCategory, getsubCategoriesOnlyIdName, subcreateCategory, subdeleteCategory, subgetCategories, subgetCategoryById, subupdateCategory } from "../controllers/subcategory.js";

const subcategoryRoute = express.Router();

/* ADMIN */
subcategoryRoute.post(
    "/",
    protect,
    isSuperAdmin,
    upload.fields([
        { name: "bannerimage", maxCount: 1 },
        { name: "smallimage", maxCount: 1 }
    ]),
    subcreateCategory
);
/* PUBLIC */
subcategoryRoute.get("/", subgetCategories);
subcategoryRoute.get("/nameonly", getsubCategoriesOnlyIdName);
subcategoryRoute.get("/by-category/:categoryId", getSubCategoriesByCategory);
subcategoryRoute.get("/:id", subgetCategoryById);


subcategoryRoute.put(
    "/:id",
    protect,
    isSuperAdmin,
    upload.fields([
        { name: "bannerimage", maxCount: 1 },
        { name: "smallimage", maxCount: 1 }
    ]),
    subupdateCategory
);

subcategoryRoute.delete(
    "/:id",
    protect,
    isSuperAdmin,
    subdeleteCategory
);

export default subcategoryRoute;
