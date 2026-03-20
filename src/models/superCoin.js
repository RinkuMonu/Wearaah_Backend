import mongoose, { Types } from "mongoose";

const superCoin = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    type: {
        type: String,
        enum: ["credit", "debit", "expire"],
        required: true,
        index: true
    },

    amount: {
        type: Number,
        required: true,
        min: 1
    },

    source: {
        type: String,
        enum: [
            "cashback",
            "order_use",
            "referral",
            "campaign_reward",
            "admin_adjustment",
            "expiry",
            "refund"
        ],
        required: true
    },

    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        default: null
    },

    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Campaign",
        default: null
    },

    referralUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    balanceAfter: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },

    expiryDate: {
        type: Date,
        default: null
    },

    note: {
        type: String,
        default: ""
    },

}, { timestamps: true });

superCoin.index({ userId: 1, createdAt: -1 });
superCoin.index({ expiryDate: 1 });

export default mongoose.model("SuperCoinModal", superCoin);