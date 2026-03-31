import express from "express";
import {
    createWithdrawalRequest,
    approveWithdrawal,
    rejectWithdrawal,
    getAllWithdrawal
} from "../controllers/withdrawalReq.controller.js";
import { protect } from "../middlewares/auth.middleware.js"
import { isSuperAdmin } from "../middlewares/role.middleware.js"


const withdrawalReq = express.Router();

// user
withdrawalReq.post("/req", protect, createWithdrawalRequest);

// admin
withdrawalReq.get("/all", protect, getAllWithdrawal);
withdrawalReq.put("/:id/approve", protect, isSuperAdmin, approveWithdrawal);
withdrawalReq.put("/:id/reject", protect, isSuperAdmin, rejectWithdrawal);

export default withdrawalReq;