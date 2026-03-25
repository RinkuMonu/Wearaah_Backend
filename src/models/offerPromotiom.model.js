import mongoose from "mongoose";

const OfferPromotion = new mongoose.Schema({
    name: String,

    type: {
        type: String,
        enum: [
            "PRODUCT",
            "CATEGORY",
            "CART",
            "BANK",
            "COUPON",
            "BXGY",
            "FLASH"
        ]
    },

    discountType: {
        type: String,
        enum: ["PERCENT", "FIXED", "FINAL_PRICE"]
    },

    value: Number,

    maxDiscount: Number,

    minOrderValue: Number,

    applicableProducts: [ObjectId],
    applicableCategories: [ObjectId],
    applicableVariants: [ObjectId],

    couponCode: String,
    usageLimit: Number,
    usedCount: Number,

    startDate: Date,
    endDate: Date,

    isActive: Boolean,

    priority: Number
});

export default mongoose.model("OfferPromotion", OfferPromotion);
