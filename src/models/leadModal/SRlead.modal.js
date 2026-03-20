import mongoose from "mongoose";

const sRSchema = new mongoose.Schema({
    leadType: {
        type: String,
        enum: ["be_seller", "be_rider"],
        required: true
    },

    name: {
        type: String,
        required: true,
        trim: true
    },

    mobile: {
        type: String,
        required: true,
        match: /^[6-9]\d{9}$/,
    },

    email: {
        type: String,
        trim: true,
        lowercase: true,
    },

    shopName: {
        type: String,
        trim: true
    },

    city: {
        type: String,
        default: "Jaipur"
    },

    businessType: {
        type: String,
        enum: ["individual", "proprietorship", "partnership", "pvt_ltd"]
    },

    leadSource: {
        type: String,
        default: "website"
    },

    status: {
        type: String,
        enum: ["new", "contacted", "converted", "rejected"],
        default: "new"
    },

    notes: String

}, { timestamps: true });
sRSchema.index({ mobile: 1, leadType: 1 }, { unique: true })
sRSchema.index({
    mobile: 1,
    email: 1,
    name: 1,
    city: 1,
    businessType: 1,
    status: 1,
    leadSource: 1
});
export default mongoose.model("SRLead", sRSchema);