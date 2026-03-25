import mongoose from "mongoose";
import counterModel from "./counter.model.js";


const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null
    },

    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true
    },
    sellerSnapshot: {
      sellerName: String,
      shopName: String,
      phone: String,
    },
    shippingAddress: {
      fullName: { type: String, required: true },
      mobile: { type: String, required: true },
      street: { type: String, required: true },
      landmark: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      location: {
        type: {
          type: String,
          enum: ["Point"]
        },
        coordinates: [Number]
      }
    },

    items: [
      {
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

        productName: {
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

        mrp: {
          type: Number,
          required: true,
          min: 0
        },
        sellingPrice: {
          type: Number,
          required: true,
          min: 0
        },

        quantity: {
          type: Number,
          required: true,
          min: 1
        },

        totalAmountofqty: {
          type: Number,
          required: true,
          min: 0
        },
        sku: {
          type: String,
          required: true,
        },

      }
    ],

    totalAmount: {
      type: Number,
      required: true
    },

    finalAmoutAfterCoinDeliverycharges: {
      type: Number,
      required: true
    },

    coinUsed: {
      type: Number,
      required: true,
    },
    walletUsed: {
      type: Number,
      required: true,
    },

    platformCommission: {
      type: Number,
      min: 0,
      required: true
    },

    sellerAmount: {
      type: Number,
      required: true,
      min: 0
    },

    deliveryCharge: {
      type: Number,
      default: 0
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "UPI", "CARD", "NETBANKING", "WALLET"],
      default: "UPI",
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded", "failed"],
      default: "pending",
      index: true
    },

    isPaid: { type: Boolean, default: false },

    settlementStatus: {
      type: String,
      enum: ["locked", "settled", "refunded"],
      default: "locked",
      index: true
    },

    orderStatus: {
      type: String,
      enum: ["placed", "accepted_by_seller", "packed", "ready_for_pickup", "assigned_to_rider", "picked", "out_for_delivery", "delivered", "shipped", "cancelled", "returned"],
      default: "placed",
      index: true
    },
    refundAmount: {
      type: Number,
      min: 0
    },
    isSeenBySeller: {
      type: Boolean,
      default: false,
    },

    refundedAt: Date,

    pgOrderId: String,
    paidAt: Date,

    returnEligibleTill: Date,

    acceptedAtbySeller: Date,
    acceptedAtbyRider: Date,

    deliveredAt: Date,

    cancelReason: String,
    returnReason: String,
    riderAssignedAt: Date,
    pickedAt: Date,
    outForDeliveryAt: Date,

    paymentTransactionId: String,
    refundTransactionId: Date,
    sellerSettledAt: Date,
    riderSettledAt: Date,
  },
  { timestamps: true }
);
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, orderStatus: 1 });
orderSchema.index({ riderId: 1, orderStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });

orderSchema.pre("validate", async function (next) {
  try {
    if (!this.isNew) return next();

    if (!this.orderNumber) {
      const today = new Date();

      const datePart =
        today.getFullYear().toString() +
        String(today.getMonth() + 1).padStart(2, "0") +
        String(today.getDate()).padStart(2, "0");

      const counter = await counterModel.findOneAndUpdate(
        { name: "order" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      const paddedSeq = counter.seq.toString().padStart(6, "0");

      this.orderNumber = `ODN-${datePart}-${paddedSeq}`;
    }

    next();
  } catch (err) {
    next(err);
  }
});


export default mongoose.model("Order", orderSchema);
