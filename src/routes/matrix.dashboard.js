import express from "express";
import { getSuperAdminDashboard } from "../controllers/MetricsApi/superAdmin.dashboard.js";
import { getSellerDashboard } from "../controllers/MetricsApi/seller.dashboard.js";
import { getRiderDashBoard } from "../controllers/MetricsApi/rider.dashboard.js";
import { protect } from "../middlewares/auth.middleware.js";


const matrixDashboard = express.Router();

matrixDashboard.get("/superAdminDashBoard", protect, getSuperAdminDashboard);
matrixDashboard.get("/sellerDashboard", protect, getSellerDashboard);
matrixDashboard.get("/riderDashbaord", protect, getRiderDashBoard);


export default matrixDashboard;
