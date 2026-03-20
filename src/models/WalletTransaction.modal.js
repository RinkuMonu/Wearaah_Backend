import mongoose from "mongoose";
import counterModel from "./counter.model.js";

const walletTransactionSchema = new mongoose.Schema({
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Wallet",
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    transactionId: {
        type: String,
        unique: true,
        index: true
    },
    type: {
        type: String,
        enum: ["credit", "debit", "lock", "top-up", "unlock", "settlement", "refund", "commission", "withdrawal"],
        required: true
    },

    reasonSource: {
        type: String,
        enum: ["order_payment", "Withdrawal", "delivery_earning", "refund", "commission", "wallet_topup", "penalty"],
        required: true
    },

    amount: {
        type: Number,
        required: true,
        min: 1
    },

    description: {
        type: String, // credit/debit/lock/order_payment/delivery_earning for order no. OD-240383-1234
        required: true,
    },

    referenceModel: {
        type: String,
        enum: ["Order", "WithdrawalRequest"]
    },

    // if(txn.referenceModel === "Order") {
    //         await Order.findById(txn.referenceId)
    //  } await withdraw.findById(txn.referenceId)

    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "referenceModel"
    },

    status: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending"
    },

    balanceAfter: {
        type: Number,
        required: true,
        min: 0
    }

}, { timestamps: true });

walletTransactionSchema.index({ walletId: 1, createdAt: -1 });
walletTransactionSchema.index({ referenceId: 1 });
walletTransactionSchema.pre("save", async function (next) {
    if (!this.transactionId) {

        const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

        const counter = await counterModel.findOneAndUpdate(
            { name: "walletTransaction" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        const padded = counter.seq.toString().padStart(6, "0");

        this.transactionId = `TXN-${date}-${padded}`;
    }

    next();
});


export default mongoose.model("WalletTransaction", walletTransactionSchema);
