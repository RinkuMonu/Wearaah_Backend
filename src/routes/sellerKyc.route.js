import express from "express";

import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../config/multer.js";
import { isSuperAdmin } from "../middlewares/role.middleware.js";
import { getAllSellers, getSellerById, sellerKycAction, submitSellerKyc } from "../controllers/seller/seller.kyc.controller.js";

const sellerkycRoute = express.Router();

sellerkycRoute.get("/getseller", protect, isSuperAdmin, getAllSellers);
sellerkycRoute.get("/getseller/:sellerId", protect, isSuperAdmin, getSellerById);
sellerkycRoute.post("/submitSellerKyc/request", protect, upload.fields([
    { name: "gstCertificate", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
    { name: "shopLicense", maxCount: 1 },
    { name: "cancelledCheque", maxCount: 1 }
]), submitSellerKyc);


// order accept


sellerkycRoute.post("/kycSellerAction/:sellerId", protect, isSuperAdmin, sellerKycAction);

export default sellerkycRoute;
