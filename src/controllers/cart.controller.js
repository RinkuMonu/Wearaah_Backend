import ProductVariant from "../models/productVariant.model.js";
import CartModal from "../models/cart.model.js"
import productVariantModel from "../models/productVariant.model.js";
import cartModel from "../models/cart.model.js";


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
    } else {
      cart.items.push({
        productId: product._id,
        variantId: variant._id,
        sellerId: variant.sellerId,
        quantity,
      });
    }

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
    }

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
    if (!id || id === undefined) {
      return res.status(404).json({ success: false, message: "variantId missing" });

    }

    const cart = await CartModal.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    cart.items = cart.items.filter(
      (item) => item.variantId.toString() !== id
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
    const userId = req.user.id
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    const cart = await cartModel.aggregate([
      { $match: { user: userId } },

      { $unwind: "$items" },

      { $match: { "items.isActive": true } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },

      {
        $lookup: {
          from: "productvariants",
          localField: "items.variantId",
          foreignField: "_id",
          as: "variant"
        }
      },
      { $unwind: "$variant" },
      {
        $group: {
          _id: "$_id",
          user: { $first: "$user" },
          // grandTotal: { $first: "$grandTotal" },
          items: {
            $push: {
              _id: "$items._id",
              productId: "$items.productId",
              variantId: "$items.variantId",
              sellerId: "$items.sellerId",
              quantity: "$items.quantity",
              price: "$items.price",

              product: {
                _id: "$product._id",
                title: "$product.name",
                description: "$product.description",
              },
              variant: {
                _id: "$variant._id",
                name: "$variant.variantTitle",
                variantImages: "$variant.variantImages",
                sellingPrice: "$variant.pricing.sellingPrice",
                mrp: "$variant.pricing.mrp",
                taxPercent: "$variant.pricing.taxPercent",
                stock: "$variant.stock"
              }
            }
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      data: cart[0] || { items: [], grandTotal: 0 }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};