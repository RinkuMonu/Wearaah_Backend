import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { isBothRole, isSeller, isSuperAdmin } from "../middlewares/role.middleware.js";
import { createProduct, updateProduct, deleteProduct, getProducts, getFilters, getProductById, adminUpdateProduct, getQcProducts, getProductsForWeb } from "../controllers/admin.product.controller.js";
import { upload } from "../config/multer.js";

const router = express.Router();
// router.post("/products", protect, isSeller, upload.single("productImage"), createProduct);
router.post("/products", protect, isBothRole, upload.array("productImage"), createProduct);
router.get("/", protect, isBothRole, getProducts);
router.get("/web", getProductsForWeb);
router.get("/getfilter", getFilters);
router.get("/qc-products", protect, isBothRole, getQcProducts);
router.get("/:id", getProductById);
router.put("/products/:id", protect, upload.array("productImage"), updateProduct);
router.delete("/products/:id", protect, isSeller, deleteProduct);
router.put("/admin/products/:id", protect, isSuperAdmin, adminUpdateProduct)



// >>>>>>>>>>>>> QC Control By Super admin >>>>>>>>>>>>>>>


// >>>>>>>>>>>>> QC Control By Super admin >>>>>>>>>>>>>>>



export default router;
