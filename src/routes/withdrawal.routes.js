import express from "express";
import {
    createWithdrawalRequest,
    getMyWithdrawals,
    getAllWithdrawals,
    approveWithdrawal,
    rejectWithdrawal
} from "../controllers/withdrawalReq.controller.js";
import { protect } from "../middlewares/auth.middleware.js"
import { isSuperAdmin } from "../middlewares/role.middleware.js"


const withdrawalReq = express.Router();

// user
withdrawalReq.post("/create", protect, createWithdrawalRequest);
withdrawalReq.get("/my", protect, getMyWithdrawals);

// admin
withdrawalReq.get("/all", protect, isSuperAdmin, getAllWithdrawals);
withdrawalReq.put("/approve/:id", protect, isSuperAdmin, approveWithdrawal);
withdrawalReq.put("/reject/:id", protect, isSuperAdmin, rejectWithdrawal);

export default withdrawalReq;