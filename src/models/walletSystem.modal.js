import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    ownerType: {
        type: String,
        enum: ["customer", "seller", "delivery_partner", "platform", "superadmin"],
        required: true,
        index: true,
    },

    availableBalance: {
        type: Number,
        default: 0,
    },
    superCoinBalance: {
        type: Number,
        default: 0,
    },

    lockedBalance: {
        type: Number,
        default: 0,// orders not delivered yet balance locked till 7days after deliver
    },

    currency: {
        type: String,
        default: "INR"
    },

    status: {
        type: String,
        enum: ["active", "suspended", "frozen"],
        default: "active"
    }

}, { timestamps: true });

walletSchema.index({ ownerId: 1, ownerType: 1 }, { unique: true });

export default mongoose.model("Wallet", walletSchema);
