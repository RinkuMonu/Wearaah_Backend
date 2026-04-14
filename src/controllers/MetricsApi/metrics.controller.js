import Product from "../../models/product.model.js";
import Order from "../../models/order.modal.js";
import Review from "../../models/review.model.js";
import mongoose from "mongoose";

// 🔥 COMMON AGGREGATION BUILDER
const getProductMetrics = async (matchCondition = {}) => {
  return await Order.aggregate([
    {
      $match: {
        orderStatus: "delivered",
        ...matchCondition
      }
    },

    { $unwind: "$items" },

    {
      $group: {
        _id: "$items.productId",
        totalSold: { $sum: "$items.quantity" },
        totalOrders: { $sum: 1 }
      }
    },

    // 🔥 JOIN PRODUCT
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },

    // 🔥 JOIN REVIEWS
    {
      $lookup: {
        from: "reviews",
        let: { productId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$productId", "$$productId"]
              }
            }
          }
        ],
        as: "reviews"
      }
    },

    {
      $addFields: {
        // avgRating: { $avg: "$reviews.rating" },
        avgRating: {
          $cond: [
            { $gt: [{ $size: "$reviews" }, 0] },
            { $avg: "$reviews.rating" },
            0
          ]
        },
        totalReviews: { $size: "$reviews" }
      }
    },

    {
      $project: {
        _id: 0,
        productId: "$_id",
        name: "$product.name",
        price: "$product.price",
        images: "$product.productImage",
        totalSold: 1,
        totalOrders: 1,
        avgRating: { $ifNull: ["$avgRating", 0] },
        totalReviews: 1
      }
    }
  ]);
};

// ✅ 1. TOP SELLING
export const getTopSellingProducts = async (req, res) => {
  try {
    let match = {};

    // 🔥 Seller filter
    if (req.user.role === "seller") {
      match.sellerId = new mongoose.Types.ObjectId(req.user.id);
    }

    const data = await getProductMetrics(match);

    const sorted = data.sort((a, b) => b.totalSold - a.totalSold);

    res.json({ success: true, data: sorted.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ 2. BEST PRODUCTS (rating + orders)
export const getBestProducts = async (req, res) => {
  try {
    let match = {};

    if (req.user.role === "seller") {
      match.sellerId = new mongoose.Types.ObjectId(req.user.id);
    }

    const data = await getProductMetrics(match);

    // 🔥 custom score
    const scored = data.map(p => ({
      ...p,
      //   score: (p.avgRating * 2) + p.totalOrders
      score: (p.avgRating * p.totalReviews * 0.5) + (p.totalOrders * 1.5)
    }));

    const sorted = scored.sort((a, b) => b.score - a.score);

    res.json({ success: true, data: sorted.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ 3. LEAST SELLING
export const getLeastSellingProducts = async (req, res) => {
  try {
    let match = {};

    if (req.user.role === "seller") {
      match.sellerId = new mongoose.Types.ObjectId(req.user.id);
    }

    const data = await getProductMetrics(match);

    const sorted = data.sort((a, b) => a.totalSold - b.totalSold);

    res.json({ success: true, data: sorted.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};