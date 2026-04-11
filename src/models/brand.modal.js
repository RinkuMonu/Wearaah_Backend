import mongoose from "mongoose";
import slugify from "slugify";

const brandSchema = new mongoose.Schema(
    {
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            required: true,
            index: true
        },

        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            minlength: 2,
            maxlength: 60
        },

        slug: {
            type: String,
            lowercase: true,
            unique: true,
            index: true
        },

        tagline: {
            type: String,
            maxlength: 120
        },

        description: {
            type: String,
            maxlength: 1000
        },

        logo: {
            type: String,
            required: true
        },
        ownerName: String,
        banner: String,

        brandType: {
            type: String,
            enum: ["own", "reseller"],
            required: true,
        },

        gstNumber: {
            type: String,
            uppercase: true,
            trim: true,
        },

        trademarkRegistered: {
            type: Boolean,
            default: false
        },
        supportEmail: {
            type: String,
            lowercase: true,
            trim: true
        },
        websiteUrl: {
            type: String,
            lowercase: true,
            trim: true
        },

        supportPhone: String,

        status: {
            type: String,
            enum: ["pending", "active", "rejected", "blocked"],
            default: "pending",
        },

        isActive: {
            type: Boolean,
            default: false,
            index: true
        },

        isFeatured: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        trademarkNumber: String,
        trademarkCertificate: String,
        authorizationLetter: String,
        countryOfOrigin: String,
        rejectionDate: Date,
        rejectionReason: String,
        approvedAt: Date,
    },
    { timestamps: true }
);

brandSchema.index({ sellerId: 1, name: 1 }, { unique: true });
brandSchema.index({ status: 1 });
brandSchema.index({ brandType: 1 });
brandSchema.index({
    name: "text",
    tagline: "text",
    description: "text",
    gstNumber: "text",
    supportEmail: "text",
    supportPhone: "text",
    countryOfOrigin: "text"
});

brandSchema.pre("validate", function (next) {
    if (this.name && this.sellerId) {
        this.slug =
            slugify(this.name, { lower: true, strict: true }) +
            "-" +
            this.sellerId.toString().slice(-4);
    }
    next();
});

export default mongoose.model("Brand", brandSchema);
