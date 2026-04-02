import express from "express";

import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../config/multer.js";
import { getAllUsers, getMyWallet, getProfile, getSellerProfile, login, logout, registerViaOtp, updateProfile, updateUserKycStatus, updateUserStatus, verifyOtp } from "../controllers/auth/auth.controller.js";
import { isSeller, isSuperAdmin } from "../middlewares/role.middleware.js";

const authRoute = express.Router();

authRoute.post("/verifyotp", verifyOtp);
authRoute.post("/register/via/otp", registerViaOtp);
authRoute.post("/login", login);
authRoute.post("/logout", logout);
authRoute.get("/me", protect, getProfile);
authRoute.get("/seller/me", protect, isSeller, getSellerProfile);
authRoute.get("/get/wallet", protect, getMyWallet);
authRoute.get("/alluser", protect, isSuperAdmin, getAllUsers);
authRoute.put("/update", protect, upload.single("avatar"), updateProfile);
authRoute.put("/update/user/status/:id", protect, updateUserStatus);

// super admin route isSuperAdmin isSuperAdmin
// super admin route isSuperAdmin isSuperAdmin
// super admin route isSuperAdmin isSuperAdmin
// super admin route isSuperAdmin isSuperAdmin
authRoute.put("/update-status", protect, isSuperAdmin, updateUserKycStatus);

export default authRoute;
