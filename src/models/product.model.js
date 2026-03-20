import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true, },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, },
  subCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory", required: true, },
  name: {
    type: String, required: true,
  },
  slug: {
    type: String,
    unique: true,
  },

  hsnCode: { type: String, required: true },

  description: {
    type: String,
    required: true,
    minlength: 20,
    maxlength: 2000
  },
  gender: {
    type: String,
    enum: ["Men", "Women", "Boys", "Girls", "Kids", "Unisex"],
    required: true,
    index: true
  },
  defaultVariantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductVariant"
  },
  countryOfOrigin: {
    type: String,
    default: "india"
  },
  productImage: [String],

  sizeType: {
    type: String,
    enum: ["alpha", "numeric", "free"]
  },
  manufacturerDetails: {
    name: String,
    address: String
  },

  status: {
    type: String,
    enum: ["draft", "pending", "approved", "rejected"],
    default: "pending"
  },

  specifications: {
    type: Map,
    of: String
  },

  isdeliveryFree: {
    type: String,
    default: true
  },

  returnPolicyDays: {
    type: Number,
    default: 7
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  isNewArrival: {
    type: Boolean,
    default: true
  },
  isTopRated: {
    type: Boolean,
    default: false
  },
  isTrending: {
    type: Boolean,
    default: false
  },
  isBestSelling: {
    type: Boolean,
    default: false
  },
  saleCount: {
    type: Number,
    default: 0
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

productSchema.index({ categoryId: 1, subCategoryId: 1, brandId: 1 });
productSchema.index({ sellerId: 1 });
productSchema.index({ name: "text", description: "text" });
productSchema.index({ rating: -1 });

export default mongoose.model("Product", productSchema);
