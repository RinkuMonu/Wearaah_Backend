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
    getAllQcVariants,
    updateVariantStock
} from "../controllers/addvariant.js";
import { isSeller, isSuperAdmin } from "../middlewares/role.middleware.js";
import { optionalAuth } from "../middlewares/optional.auth.md.js";

const addvarintRoute = express.Router();

/* USER */
addvarintRoute.get(
    "/products/:productId/variants",
    optionalAuth,
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
addvarintRoute.get(
    "/admin/qc-variants/:productId",
    getAllQcVariants
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
    // isSuperAdmin,   // ✅ only admin
    updateVariantStatusByAdmin
);
addvarintRoute.delete(
    "/admin/variants/:id",
    protect,
    deleteVariant
);


export default addvarintRoute;
