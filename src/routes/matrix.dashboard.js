import express from "express";
import { getSuperAdminDashboard } from "../controllers/MetricsApi/superAdmin.dashboard.js";
import { getSellerDashboard } from "../controllers/MetricsApi/seller.dashboard.js";
import { getRiderDashBoard } from "../controllers/MetricsApi/rider.dashboard.js";
import { protect } from "../middlewares/auth.middleware.js";
import { isRider, isSeller, isSuperAdmin } from "../middlewares/role.middleware.js";


const matrixDashboard = express.Router();

matrixDashboard.get("/superAdminDashBoard", protect, isSuperAdmin, getSuperAdminDashboard);
matrixDashboard.get("/sellerDashboard", protect, isSeller, getSellerDashboard);
matrixDashboard.get("/riderDashbaord", protect, isRider, getRiderDashBoard);


export default matrixDashboard;
