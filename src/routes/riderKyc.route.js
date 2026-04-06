import express from "express";
import { getAllRiders, getRiderById, riderKycAction, submitRiderKyc, updateRiderStatus } from "../controllers/rider/rider.kyc.controller.js";
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

riderkycRoute.post("/kycRiderAction/:riderId", protect, isSuperAdmin, riderKycAction);

export default riderkycRoute;
