import mongoose from "mongoose";

const commissionRuleSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["GLOBAL", "CATEGORY", "SELLER"],
            required: true,
        },

        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            default: null,
        },

        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            default: null,
        },

        commissionPercent: {
            type: Number,
            required: true,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        effectiveFrom: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

export default mongoose.model("CommissionRule", commissionRuleSchema);