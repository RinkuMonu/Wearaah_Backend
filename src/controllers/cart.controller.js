import ProductVariant from "../models/productVariant.model.js";
import CartModal from "../models/cart.model.js"
import productVariantModel from "../models/productVariant.model.js";


export const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { variantId, quantity = 1 } = req.body;

    // 🔹 Variant check
    const variant = await productVariantModel.findById(variantId).populate({
      path: "productId",
      select: "_id"
    }).select("productId sellerId stock status pricing")

    if (!variant) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    const product = variant.productId;
    // 🔹 Stock check
    if (variant.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `only ${variant.stock} items available in stock`
      });
    }

    // 🔹 Get or create cart
    let cart = await CartModal.findOne({ user: userId });

    if (!cart) {
      cart = new CartModal({ user: userId, items: [] });
    }

    // 🔹 Check existing item
    const existingItem = cart.items.find(
      (item) => item.variantId.toString() === variantId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.finalPrice = existingItem.quantity * existingItem.sellingPrice;
    } else {
      cart.items.push({
        productId: product._id,
        variantId: variant._id,
        sellerId: variant.sellerId,
        mrp: variant.pricing?.mrp,
        sellingPrice: variant.pricing?.sellingPrice,
        quantity,
        finalPrice: variant.pricing?.sellingPrice * quantity
      });
    }

    // 🔹 Grand total
    cart.grandTotal = cart.items.reduce(
      (sum, item) => sum + item.finalPrice,
      0
    );

    await cart.save();

    return res.json({
      success: true,
      message: "Item added to cart",
      cart
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};






export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    let { variantId, quantity } = req.body;

    // 🔥 FIX 1: force number
    quantity = Number(quantity);

    if (!variantId || isNaN(quantity)) {
      return res.status(400).json({
        success: false,
        message: "Invalid data"
      });
    }

    const cart = await CartModal.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    // 🔥 FIX 2: safe comparison
    const item = cart.items.find(
      (i) => i.variantId.toString() === variantId.toString()
    );

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    // 🔥 STOCK CHECK
    const variant = await ProductVariant.findById(variantId).select("stock").lean()

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found"
      });
    }

    if (quantity > variant.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${variant.stock} items available`
      });
    }

    // 🔥 REMOVE IF ZERO
    if (quantity <= 0) {
      cart.items = cart.items.filter(
        (i) => i.variantId.toString() !== variantId.toString()
      );
    } else {
      item.quantity = quantity; // 🔥 actual update
      item.finalPrice = item.sellingPrice * quantity;
    }

    // 🔥 TOTAL RECALC
    cart.grandTotal = cart.items.reduce(
      (sum, item) => sum + item.finalPrice,
      0
    );

    await cart.save();

    return res.json({
      success: true,
      message: "Cart updated",
      cart
    });

  } catch (err) {
    console.error("UPDATE CART ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};












export const removeCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!id) {
      return res.status(404).json({ success: false, message: "variantId missing" });

    }

    const cart = await CartModal.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    cart.items = cart.items.filter(
      (item) => item.variantId.toString() !== id
    );

    cart.grandTotal = cart.items.reduce(
      (sum, item) => sum + item.finalPrice,
      0
    );

    await cart.save();

    return res.json({
      success: true,
      message: "Item removed",
      cart
    });

  } catch (err) {
    console.log(err)
    res.status(500).json({ success: false, message: err.message });
  }
};



export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await CartModal.findOne({ user: userId });

    return res.json({
      success: true,
      cart: cart || { items: [], grandTotal: 0 }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};