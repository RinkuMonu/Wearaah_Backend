import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema({
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
    invoiceNumber: {
        type: String,
        required: true,
        trim: true,
    },
    customerName: {
        type: String,
        required: true,
        trim: true,
    },
    customerMobile: {
        type: String,
        required: true,
        match: /^[6-9]\d{9}$/,
    },
    customerEmail: {
        type: String,
    },
    subtotal: {// total of variant before gst
        type: Number,
        required: true,
    },
    gstAmount: {
        type: Number,
        required: true,
    },
    totaldiscount: {
        type: Number,
        required: true,
    },
    grandTotal: { // with tax 
        type: Number,
        required: true,
    },
    paymentMode: {
        type: String,
        enum: ["CASH", "UPI", "CARD"],
        default:"UPI",
        // required: true,
    },
    items: [
        {
            variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", required: true },
            variantName: {
                type: String, required: true,
                trim: true
            },
            sku: {
                type: String, required: true,
                trim: true
            },
            hsnCode: {
                type: String,
                trim: true
            },
            quantity: {
                type: Number, required: true, min: 1
            },
            mrp: {
                type: Number, required: true
            },
            sellingPrice: { // per variant price
                type: Number, required: true
            },
            discountPercent: {
                type: Number, required: true
            },
            discountAmount: {
                type: Number, required: true
            },
            taxPercent: { // tax percent
                type: Number, required: true
            },
            cgstPercent: {
                type: Number, required: true
            },
            sgstPercent: {
                type: Number, required: true
            },
            cgstAmount: {
                type: Number, required: true
            },
            sgstAmount: {
                type: Number, required: true
            },
            totaltaxAmount: { // total tax
                type: Number, required: true
            },
            subtotal: { // total without tax
                type: Number, required: true
            },
            total: { // total 
                type: Number,
                required: true,
            },
        }
    ],
}, { timestamps: true });

export default mongoose.model("InvoiceOffline", invoiceSchema);
