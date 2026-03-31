import express from "express";
import { getWishlist, moveToCart, toggleWishlist } from "../controllers/wishlist.controller.js";

// import { isSuperAdmin } from "../middlewares/role.middleware.js";
import { protect } from "../middlewares/auth.middleware.js";


const wishlistRoute = express.Router();

wishlistRoute.post("/", protect, toggleWishlist);
wishlistRoute.post("/move-to-cart", protect, moveToCart);
wishlistRoute.get("/", protect, getWishlist);
// wishlistRoute.post("/remove", protect, removeItemFromWishlist);
// wishlistRoute.delete("/clear", protect, isSuperAdmin, clearWishlist);

export default wishlistRoute;