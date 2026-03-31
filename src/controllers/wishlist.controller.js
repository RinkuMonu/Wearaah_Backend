import mongoose from "mongoose";
import Wishlist from "../models/wishlist.model.js";
import ProductVariant from "../models/productVariant.model.js";
import cartModel from "../models/cart.model.js";


/* =========================
   ADD ITEM TO WISHLIST
========================= */

export const toggleWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { variantId } = req.body;

    if (!variantId) {
      return res.status(400).json({
        success: false,
        message: "variantId required"
      });
    }
    const variantCheck = await ProductVariant.findById(variantId).select("_id productId");
    if (!variantCheck) {
      return res.status(404).json({
        success: false,
        message: "Variant not found"
      });
    }
    const existing = await Wishlist.findOne({
      userId,
      variantId
    });

    if (existing) {
      await Wishlist.deleteOne({ _id: existing._id });

      return res.json({
        success: true,
        message: "Removed from wishlist",
        isWishlisted: false
      });
    }

    await Wishlist.create({
      userId,
      productId: variantCheck.productId,
      variantId
    });

    return res.json({
      success: true,
      message: "Added to wishlist",
      isWishlisted: true
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }
};


// move to cart 

export const moveToCart = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { variantId } = req.body;

    if (!variantId) {
      throw new Error("variantId required");
    }

    // 🔥 1. Check wishlist item
    const wishlistItem = await Wishlist.findOne({
      userId,
      variantId
    }).session(session);

    if (!wishlistItem) {
      throw new Error("Item not in wishlist");
    }

    // 🔥 2. Get variant
    const variant = await ProductVariant.findById(variantId)
      .select("productId stock sellerId")
      .session(session);

    if (!variant) {
      throw new Error("Variant not found");
    }

    if (variant.stock <= 0) {
      throw new Error("Out of stock");
    }

    // 🔥 3. Find or create cart
    let cart = await cartModel.findOne({ user: userId }).session(session);

    if (!cart) {
      cart = await cartModel.create([{
        user: userId,
        items: []
      }], { session });

      cart = cart[0];
    }

    // 🔥 4. Check if already in cart
    const existingItem = cart.items.find(
      item => item.variantId.toString() === variantId
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.items.push({
        productId: variant.productId,
        variantId: variant._id,
        sellerId: variant.sellerId,
        quantity: 1,
      });
    }

    await cart.save({ session });

    // 🔥 5. Remove from wishlist
    await Wishlist.deleteOne({
      _id: wishlistItem._id
    }).session(session);

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Moved to cart successfully"
    });

  } catch (error) {
    await session.abortTransaction();

    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

// get wishlist

export const getWishlist = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const pipeline = [

      // 🔥 only user data
      {
        $match: { userId }
      },

      {
        $lookup: {
          from: "productvariants",
          localField: "variantId",
          foreignField: "_id",
          as: "variant"
        }
      },
      { $unwind: "$variant" },

      {
        $match: {
          "variant.isActive": true,
          "variant.status": "approved"
        }
      },

      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 1,
          addedAt: "$createdAt",

          product: {
            _id: "$product._id",
            name: "$product.name",
            image: { $arrayElemAt: ["$product.productImage", 0] }
          },

          variant: {
            _id: "$variant._id",
            title: "$variant.variantTitle",
            price: "$variant.pricing.sellingPrice",
            mrp: "$variant.pricing.mrp",
            stock: "$variant.stock",
            image: { $arrayElemAt: ["$variant.variantImages", 0] }
          },

          // 🔥 UI flags
          isOutOfStock: { $lte: ["$variant.stock", 0] },
          isLowStock: { $and: [{ $gt: ["$variant.stock", 0] }, { $lte: ["$variant.stock", 5] }] }
        }
      },

      // 🔥 latest first
      { $sort: { addedAt: -1 } },

      // 🔥 pagination + count
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const result = await Wishlist.aggregate(pipeline);

    const wishlist = result[0].data;
    const total = result[0].totalCount[0]?.count || 0;

    res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      wishlist
    });

  } catch (error) {
    console.error("Wishlist Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};