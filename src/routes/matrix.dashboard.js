import express from "express";
import { getSuperAdminDashboard } from "../controllers/MetricsApi/superAdmin.dashboard.js";
import { getSellerDashboard } from "../controllers/MetricsApi/seller.dashboard.js";
import { getRiderDashBoard } from "../controllers/MetricsApi/rider.dashboard.js";


const matrixDashboard = express.Router();

matrixDashboard.post("/superAdminDashBoard", getSuperAdminDashboard);
matrixDashboard.post("/sellerDashboard", getSellerDashboard);
matrixDashboard.post("/riderDashbaord", getRiderDashBoard);


export default matrixDashboard;
