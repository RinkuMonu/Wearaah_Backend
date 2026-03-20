import mongoose from "mongoose";

const subcategorySchema = new mongoose.Schema({
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
        index: true
    },

    name: { type: String, required: true, trim: true },

    slug: { type: String, index: true, required: true, unique: true },

    smallimage: String,
    bannerimage: String,

    sizeType: {
        type: String,
        enum: ["alpha", "numeric", "free"],
        required: true,
        default: "alpha"
    },

    showOnHome: {
        type: Boolean,
        default: false
    },
    
    displayOrder: {
        type: Number,
        default: 0
    },

    attributes: {
        type: Map,
        of: new mongoose.Schema({
            values: [String],
            required: Boolean,
            filterable: Boolean
        })
    },
    taxPercent: {
        type: Number,
        // required: true
    },
    variantAttributes: [String],

    isActive: { type: Boolean, default: true }
},
    { timestamps: true });
subcategorySchema.index({ categoryId: 1, name: 1 }, { unique: true })
const SubCategory = mongoose.model("SubCategory", subcategorySchema);
export default SubCategory;