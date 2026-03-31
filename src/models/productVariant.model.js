import mongoose from "mongoose";

const productVariantSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId, ref: "Product",
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId, ref: "Seller",
    required: true
  },
  variantTitle: {
    type: String,
    required: true
  },
  variantDiscription: {
    type: String,
    required: true
  },

  size: {
    type: String,
    required: true
  },

  color: {
    type: String,
    required: true
  },
  pricing: {
    costPrice: {
      type: Number,// this price will not show to another
      required: true,
      default: null
    },
    mrp: {
      type: Number,
      min: 1,
      required: true,
    },
    sellingPrice: {
      type: Number,
      min: 1,
      required: true
    },
    taxPercent: { type: Number, default: 0 }
  },

  returnable: { type: Boolean, default: true },

  stock: {
    type: Number,
    default: 0
  },

  sku: {
    type: String,
    unique: true,
    required: true
  },

  variantImages: [String],
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    index: true
  },

  isWishlisted: {
    type: Boolean,
    default: false
  },

  qcActionBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  qcNote: {
    type: String,
    default: ""
  },
  qcAt: Date,
  isActive: { type: Boolean, default: true, index: true, }
},
  {
    optimisticConcurrency: true
  },
  { timestamps: true },
);
productVariantSchema.index({ productId: 1 });
productVariantSchema.index({ "pricing.sellingPrice": 1 });
productVariantSchema.index(
  { productId: 1, size: 1, color: 1 },
  { unique: true }
);
productVariantSchema.index({ productId: 1, stock: 1 }, { partialFilterExpression: { stock: { $gt: 0 } } });
productVariantSchema.index({ isActive: 1, status: 1, stock: 1 });



export default mongoose.model("ProductVariant", productVariantSchema);
