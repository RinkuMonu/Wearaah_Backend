import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    /* 🔗 RELATION */
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true
    },

    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    isActive: {
      type: Boolean,
      default: true
    }

  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [cartItemSchema],
  },
  { timestamps: true }
);
cartSchema.index({ user: 1 }, { unique: true });
cartSchema.index({ "items.variantId": 1 });
cartSchema.index({ "items.sellerId": 1 });

export default mongoose.model("CartModal", cartSchema);
