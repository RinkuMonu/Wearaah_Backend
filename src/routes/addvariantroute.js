import express from "express";

import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../config/multer.js";
import {
    addVariant,
    getVariantsByProduct,
    updateVariant,
    deleteVariant,
    getVariantById,
    getAllVariants,
    updateVariantStatusByAdmin,
    updateVariantStock
} from "../controllers/addvariant.js";
import { isSeller, isSuperAdmin } from "../middlewares/role.middleware.js";

const addvarintRoute = express.Router();

/* USER */
addvarintRoute.get(
    "/products/:productId/variants",
    getVariantsByProduct
);

/* USER */
addvarintRoute.get("/:id", getVariantById);


/* ADMIN */
addvarintRoute.get(
    "/admin/variants",
    // protect,
    // isSeller,
    // isSuperAdmin,
    getAllVariants
);


/* SELLER */
addvarintRoute.post(
    "/admin/products/:productId/variants",
    protect,
    upload.array("variantImages", 5),
    addVariant
);

addvarintRoute.put(
    "/admin/variants/:id",
    protect,
    upload.array("variantImages", 5),
    updateVariant
);

// bulkStock update using bulkwrite
addvarintRoute.put("/bulkstockupdate", protect, updateVariantStock);

addvarintRoute.put(
    "/admin/variant/:id/status",
    protect,
    isSuperAdmin,   // ✅ only admin
    updateVariantStatusByAdmin
);
addvarintRoute.delete(
    "/admin/variants/:id",
    protect,
    deleteVariant
);


export default addvarintRoute;
