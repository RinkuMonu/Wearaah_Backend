import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({

  // 🔗 Relations
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true
  },

  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Variant",
    required: true,
    index: true
  },

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true
  },

  // ⭐ Rating
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },

  // 📝 Review Content
  title: {
    type: String,
    trim: true,
    maxlength: 100
  },

  comment: {
    type: String,
    trim: true,
    required: true,
    maxlength: 200
  },

  // 📸 Media
  rvImages: [
    {
      type: String
    }
  ],

  likedBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],
  likes: {
    type: Number,
    default: 0
  },

  dislikedBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],

  dislikes: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },

  ratingBreakdown: {
    quality: { type: Number, min: 1, max: 5 },
    fit: { type: Number, min: 1, max: 5 },
    valueForMoney: { type: Number, min: 1, max: 5 }
  },

}, { timestamps: true });


// 🔥 Unique constraint (1 order = 1 review per variant)
reviewSchema.index({ userId: 1, variantId: 1, orderId: 1 }, { unique: true });

// 🔥 Fast query indexes
reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ variantId: 1, createdAt: -1 });
reviewSchema.index({ rating: 1 });

export default mongoose.model("Review", reviewSchema);