import express from "express";
import { getSuperAdminDashboard } from "../controllers/MetricsApi/superAdmin.dashboard.js";
import { getSellerDashboard } from "../controllers/MetricsApi/seller.dashboard.js";
import { getRiderDashBoard } from "../controllers/MetricsApi/rider.dashboard.js";
import { protect } from "../middlewares/auth.middleware.js";
import { isRider, isSeller, isSuperAdmin } from "../middlewares/role.middleware.js";
import { isBothRole } from "../middlewares/role.middleware.js";

import { getBestProducts, getLeastSellingProducts, getTopSellingProducts } from "../controllers/MetricsApi/metrics.controller.js";


const matrixDashboard = express.Router();

matrixDashboard.get("/superAdminDashBoard", protect, isSuperAdmin, getSuperAdminDashboard);
matrixDashboard.get("/sellerDashboard", protect, isSeller, getSellerDashboard);
matrixDashboard.get("/riderDashbaord", protect, isRider, getRiderDashBoard);


// 🔥 PRODUCT METRICS
matrixDashboard.get(
  "/top-selling",
  protect,
  isBothRole,
  getTopSellingProducts
);

matrixDashboard.get(
  "/best-products",
  protect,
  isBothRole,
  getBestProducts
);

matrixDashboard.get(
  "/least-selling",
  protect,
  isBothRole,
  getLeastSellingProducts
);


export default matrixDashboard;
