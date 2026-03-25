import express from "express";
import {
  addToCart,
  getCart,
  removeCartItem,
  updateCartItem
} from "../controllers/cart.controller.js";

import { protect } from "../middlewares/auth.middleware.js";


const cartRoute = express.Router();

cartRoute.get("/", protect, getCart);
cartRoute.post("/add", protect, addToCart);
cartRoute.post("/updateCart", protect, updateCartItem);
cartRoute.post("/removecart/:id", protect, removeCartItem);
// cartRoute.post("/update", protect, updateCartItemQuantity);
// cartRoute.post("/remove", protect, removeItemFromCart);
// cartRoute.get("/", protect, getCart);
// cartRoute.post("/checkout", protect, checkoutCart);

export default cartRoute;
