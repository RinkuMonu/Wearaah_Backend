import express from "express";

import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../config/multer.js";
import { isSuperAdmin } from "../middlewares/role.middleware.js";
import { getAllSellers, getSellerById, saveAddress, saveBankDetails, saveBasicInfo, saveDocuments, sellerKycAction, submitSellerKyc, verification } from "../controllers/seller/seller.kyc.controller.js";

const sellerkycRoute = express.Router();

sellerkycRoute.get("/getseller", protect, isSuperAdmin, getAllSellers);
sellerkycRoute.get("/getseller/:sellerId", protect, isSuperAdmin, getSellerById);
// sellerkycRoute.post("/submitSellerKyc/request", protect, upload.fields([
//     { name: "gstCertificate", maxCount: 1 },
//     { name: "panCard", maxCount: 1 },
//     { name: "shopLicense", maxCount: 1 },
//     { name: "cancelledCheque", maxCount: 1 }
// ]), submitSellerKyc);


// order accept
/* ---------------- STEP 1 ---------------- */
sellerkycRoute.post("/verification", verification);
/* ---------------- STEP 2 ---------------- */
sellerkycRoute.post("/basic", protect, saveBasicInfo);

/* ---------------- STEP 3 ---------------- */
sellerkycRoute.post("/address", protect, saveAddress);

/* ---------------- STEP 4 ---------------- */
sellerkycRoute.post("/bank", protect, saveBankDetails);

/* ---------------- STEP 5 (DOCS + TERMS) ---------------- */
sellerkycRoute.post(
    "/documents",
    protect,
    upload.fields([
        { name: "panCard", maxCount: 1 },
        { name: "aadhaarFront", maxCount: 1 },
        { name: "aadhaarBack", maxCount: 1 },
        { name: "shopLicense", maxCount: 1 },
        { name: "cancelledCheque", maxCount: 1 },
        { name: "gstCertificate", maxCount: 1 }
    ]),
    saveDocuments
);

sellerkycRoute.post("/kycSellerAction/:sellerId", protect, isSuperAdmin, sellerKycAction);

export default sellerkycRoute;
