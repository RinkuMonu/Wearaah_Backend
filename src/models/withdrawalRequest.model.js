import mongoose from "mongoose";
import counterModel from "./counter.model.js";

const withdrawalRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      unique: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 1
    },

    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "upi"],
      required: true
    },

    // 🔥 Dynamic payout details
    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String
    },

    upiDetails: {
      upiId: String,
      name: String
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "processed"],
      default: "pending",
      index: true
    },

    // 🔥 Admin handling
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    processedAt: Date,

    rejectionReason: String,

    // 🔥 Transaction linking
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction"
    },

    externalTxnId: String,

    notes: String
  },
  { timestamps: true }
);


// ✅ Indexing for fast queries
withdrawalRequestSchema.index({ userId: 1, createdAt: -1 });
withdrawalRequestSchema.pre("save", async function (next) {
  if (!this.requestId) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const counter = await counterModel.findOneAndUpdate(
      { name: "withdrawalRequest" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const padded = counter.seq.toString().padStart(6, "0");

    this.requestId = `WR-${date}-${padded}`;
  }

  next();
});

export default mongoose.model("WithdrawalRequest", withdrawalRequestSchema);