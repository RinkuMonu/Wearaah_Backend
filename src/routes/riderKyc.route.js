import express from "express";
import { getAllRiders, getRiderById, riderKycAction, riderVerification, saveRiderBank, saveRiderBasic, saveRiderDocuments, saveRiderLocation, submitRiderKyc, updateRiderStatus } from "../controllers/rider/rider.kyc.controller.js";
import { upload } from "../config/multer.js";
import { protect } from "../middlewares/auth.middleware.js";
import { isSuperAdmin } from "../middlewares/role.middleware.js";

const riderkycRoute = express.Router();

riderkycRoute.get("/getriders", protect, isSuperAdmin, getAllRiders);
riderkycRoute.get("/getriders/:riderId", protect, isSuperAdmin, getRiderById);
riderkycRoute.put("/updateRiderStatus/:riderId", protect, isSuperAdmin, updateRiderStatus);

riderkycRoute.post("/submitRiderKyc/request", protect, upload.fields([
    { name: "rcDocument" },
    { name: "licenseDocument" },
    { name: "aadharDocument" }
]), submitRiderKyc);


/* ---------------- STEP 1 ---------------- */
riderkycRoute.post(
    "/kyc/verification",
    // protect,
    riderVerification
);

/* ---------------- STEP 2 ---------------- */
riderkycRoute.post(
    "/kyc/basic",
    saveRiderBasic
);

/* ---------------- STEP 3 ---------------- */
riderkycRoute.post(
    "/kyc/location",
    saveRiderLocation
);

/* ---------------- STEP 4 ---------------- */
riderkycRoute.post(
    "/kyc/bank",
    saveRiderBank
);

/* ---------------- STEP 5 ---------------- */
riderkycRoute.post(
    "/kyc/documents",
    upload.fields([
        { name: "rcDocument", maxCount: 1 },
        { name: "licenseDocument", maxCount: 1 },
        { name: "aadharDocument", maxCount: 1 }
    ]),
    saveRiderDocuments
);












riderkycRoute.post("/kycRiderAction/:riderId", protect, isSuperAdmin, riderKycAction);

export default riderkycRoute;
