import express from "express";
import { getWalletTransactions } from "../../controllers/Reports/wallectTracation.js";
import { protect } from "../../middlewares/auth.middleware.js";

const walletTrancation = express.Router();

walletTrancation.get("/", protect, getWalletTransactions);

export default walletTrancation;
