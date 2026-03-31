import mongoose from "mongoose";
import orderModal from "../models/order.modal.js";
import productVariantModel from "../models/productVariant.model.js";
import Review from "../models/review.model.js";
import productQueue from "../queues/productQueues/product.queue.js";


export const createReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { variantId, rating=0, title, comment, ratingBreakdown } = req.body;

    // 🔥 1. Validation
    if (!variantId || !rating || !title) {
      return res.status(400).json({
        success: false,
        message: "rating, and title are required"
      });
    }
    if (ratingBreakdown) {
      const { quality, fit, valueForMoney } = ratingBreakdown;

      if (quality && (quality < 1 || quality > 5)) {
        return res.status(400).json({ message: "Invalid quality rating" });
      }

      if (fit && (fit < 1 || fit > 5)) {
        return res.status(400).json({ message: "Invalid fit rating" });
      }

      if (valueForMoney && (valueForMoney < 1 || valueForMoney > 5)) {
        return res.status(400).json({ message: "Invalid value rating" });
      }
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 to 5"
      });
    }

    const variant = await productVariantModel.findById(variantId).select("productId").lean();

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found"
      });
    }
    const productId = variant.productId;
    const order = await orderModal.findOne({
      customerId: userId,
      orderStatus: "delivered",
      "items.variantId": new mongoose.Types.ObjectId(variantId)
    }).select("_id").sort({ createdAt: -1 }).lean();

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "You can only review purchased & delivered items"
      });
    }

    const existingReview = await Review.findOne({
      userId,
      variantId,
      orderId: order._id
    }).select("_id").lean();

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You already reviewed this item"
      });
    }
    let rvImages = [];
    if (req.files && req.files.length > 0) {
      rvImages = req.files.map(file => `/uploads/${file.filename}`)
    }


    const review = await Review.create({
      userId,
      productId,
      variantId,
      orderId: order._id,
      rating,
      title,
      comment,
      rvImages,
      ratingBreakdown: ratingBreakdown || {}
    });

    await productQueue.add("product_update_rating", {
      productId,
      rating
    }, {
      jobId: `productRate-${review._id}`
    });

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review
    });

  } catch (error) {
    console.error("Create Review Error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate review"
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};





// get by variant id 

export const getReviewsByVariant = async (req, res) => {
  try {
    const { variantId, page = 1, limit = 10 } = req.query;

    // 🔥 1. Validation
    if (!variantId) {
      return res.status(400).json({
        success: false,
        message: "variantId is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid variantId"
      });
    }

    const skip = (Number(page) - 1) * Number(limit);

    // 🔥 2. Get reviews + stats (single aggregation = fast 🚀)
    const result = await Review.aggregate([
      {
        $match: {
          variantId: new mongoose.Types.ObjectId(variantId)
        }
      },

      {
        $facet: {
          // 📦 reviews data
          reviews: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },

            // 👤 user details
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "user"
              }
            },
            {
              $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true
              }
            },

            {
              $project: {
                rating: 1,
                comment: 1,
                title: 1,
                images: 1,
                likes: 1,
                ratingBreakdown: 1,
                createdAt: 1,
                "user.name": 1,
                "user.email": 1
              }
            }
          ],

          // 📊 stats
          stats: [
            {
              $group: {
                _id: null,
                avgRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },

                avgQuality: { $avg: "$ratingBreakdown.quality" },
                avgFit: { $avg: "$ratingBreakdown.fit" },
                avgValue: { $avg: "$ratingBreakdown.valueForMoney" }
              }
            }
          ]
        }
      }
    ]);

    const reviews = result[0].reviews;
    const stats = result[0].stats[0] || {
      avgRating: 0,
      totalReviews: 0
    };

    res.json({
      success: true,
      reviews,
      stats,
      page: Number(page),
      limit: Number(limit)
    });

  } catch (error) {
    console.error("Get Reviews Error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




// like dislike toggle 
export const toggleReaction = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const { reviewId } = req.params;
    const { action } = req.body;

    if (!["like", "dislike"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    let update = {};

    if (action === "like") {
      update = [
        {
          $set: {
            likedBy: {
              $cond: [
                { $in: [userId, "$likedBy"] },
                { $setDifference: ["$likedBy", [userId]] },
                { $concatArrays: ["$likedBy", [userId]] }
              ]
            },
            dislikedBy: {
              $setDifference: ["$dislikedBy", [userId]]
            }
          }
        },
        {
          $set: {
            likes: { $size: "$likedBy" },
            dislikes: { $size: "$dislikedBy" }
          }
        }
      ];
    }

    if (action === "dislike") {
      update = [
        {
          $set: {
            dislikedBy: {
              $cond: [
                { $in: [userId, "$dislikedBy"] },
                { $setDifference: ["$dislikedBy", [userId]] },
                { $concatArrays: ["$dislikedBy", [userId]] }
              ]
            },
            likedBy: {
              $setDifference: ["$likedBy", [userId]]
            }
          }
        },
        {
          $set: {
            likes: { $size: "$likedBy" },
            dislikes: { $size: "$dislikedBy" }
          }
        }
      ];
    }

    const updated = await Review.findByIdAndUpdate(
      reviewId,
      update,
      { new: true }
    );

    res.json({
      success: true,
      likes: updated.likes,
      dislikes: updated.dislikes,
      isLiked: updated.likedBy.includes(userId),
      isDisliked: updated.dislikedBy.includes(userId)
    });

  } catch (error) {
    console.error("Reaction Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};



// update review

export const updateReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reviewId } = req.params;
    const { rating, comment, title, ratingBreakdown } = req.body;
    console.log("Update Review Request:", { userId, reviewId, rating, comment, title, ratingBreakdown });

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reviewId"
      });
    }

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    // 🔐 Ownership check
    if (review.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // ⭐ validation
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 to 5"
      });
    }
    if (ratingBreakdown) {
      const { quality, fit, valueForMoney } = ratingBreakdown;

      if (quality && (quality < 1 || quality > 5)) {
        return res.status(400).json({ success: false, message: "Invalid quality rating" });
      }

      if (fit && (fit < 1 || fit > 5)) {
        return res.status(400).json({ success: false, message: "Invalid fit rating" });
      }

      if (valueForMoney && (valueForMoney < 1 || valueForMoney > 5)) {
        return res.status(400).json({ success: false, message: "Invalid value rating" });
      }
    }

    // 🔥 update fields (only if provided)
    if (rating) review.rating = rating;
    if (comment) review.comment = comment;
    if (title) review.title = title;
    if (ratingBreakdown) review.ratingBreakdown = ratingBreakdown;
    await review.save();

    res.json({
      success: true,
      message: "Review updated successfully",
      review
    });

  } catch (error) {
    console.error("Update Review Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


//delet review

export const deleteReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reviewId"
      });
    }

    const review = await Review.findById(reviewId).select("userId isActive");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    // 🔐 Ownership check
    if (review.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // 🔥 Soft delete
    review.isActive = false;
    await review.save();

    res.json({
      success: true,
      message: "Review deleted successfully"
    });

  } catch (error) {
    console.error("Delete Review Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};