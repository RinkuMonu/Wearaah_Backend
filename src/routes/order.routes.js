import express from "express";
import {
  createOrder,
  getOrderById,
  deleteOrder,
  OfflinePurchaseInvoiceGen,
  getOrders,
  acceptOrderBySeller,
  getUnseenOrders,
  markOrdersSeen,
  getAllOrders,
  cancelOrder
} from "../controllers/order.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { isSeller, isSuperAdmin } from "../middlewares/role.middleware.js";

const router = express.Router();

// User
router.post("/", protect, createOrder);
router.post("/cancelorder/:id", protect, cancelOrder);
router.get("/my", protect, getOrders); // for web app customer
router.get("/myAll", protect, isSuperAdmin, getAllOrders); // admin and seller
// seller get unseen order//
router.get("/unseen", protect, getUnseenOrders);
// get order by id?
// seller route
router.put("/mark-seen", protect, markOrdersSeen);
router.put("/offlinePurchase", protect, OfflinePurchaseInvoiceGen);
router.patch("/seller/accept/:orderId", protect, acceptOrderBySeller)

// admin route
router.get("/:id", protect, getOrderById);
router.delete("/:id", protect, isSuperAdmin, deleteOrder);

export default router;
