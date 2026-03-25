import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { isSeller, isSuperAdmin } from "../middlewares/role.middleware.js";
import { createProduct, updateProduct, deleteProduct, getProducts, getFilters, getProductById, adminUpdateProduct } from "../controllers/admin.product.controller.js";
import { upload } from "../config/multer.js";

const router = express.Router();
// router.post("/products", protect, isSeller, upload.single("productImage"), createProduct);
router.post("/products", protect, isSuperAdmin, upload.array("productImage"), createProduct);
router.get("/",  getProducts);
router.get("/getfilter", getFilters);
router.get("/:id", getProductById);
router.put("/products/:id", protect, upload.array("productImage"), updateProduct);
router.delete("/products/:id", protect, isSeller, deleteProduct);
router.put("/admin/products/:id", protect, isSuperAdmin, adminUpdateProduct)



// >>>>>>>>>>>>> QC Control By Super admin >>>>>>>>>>>>>>>
// >>>>>>>>>>>>> QC Control By Super admin >>>>>>>>>>>>>>>



export default router;
