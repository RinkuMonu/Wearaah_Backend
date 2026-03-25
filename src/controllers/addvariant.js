import mongoose from "mongoose";
import Product from "../models/product.model.js";
import ProductVariant from "../models/productVariant.model.js";

/* =========================
   ADD VARIANT (ADMIN)
   POST /api/admin/products/:productId/variants
========================= */

const formatCode = (value = "") => value.toString().replace(/\s+/g, "").toUpperCase().slice(0, 4);
const generateSKU = (product, size, color) => {
    const brandCode = "WEAR";
    const categoryCode = formatCode(product?.categoryId?.name || "GEN");
    const sizeCode = formatCode(size || "STD");
    const colorCode = formatCode(color || "DEF");
    const uniqueCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${brandCode}-${categoryCode}-${colorCode}-${sizeCode}-${uniqueCode}`;
};



export const addVariant = async (req, res) => {
    try {
        const { productId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }
        let { stock, variantTitle, variantDiscription, pricing, size, color, } = req.body;

        if (!variantTitle || !size || !color) {
            return res.status(400).json({
                success: false,
                message: "variantTitle, size, color, cannot be empty"
            });
        }

        /* ---------------- IMAGES ---------------- */

        const variantImages = req.files?.map(
            file => `/uploads/${file.filename}`
        ) || [];

        if (!variantImages || variantImages.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Minimum 3 variant images are required"
            });
        }

        /* ---------------- PARSE PRICING ---------------- */

        if (typeof pricing === "string") {
            try {
                pricing = JSON.parse(pricing);
            } catch {
                return res.status(400).json({
                    success: false,
                    message: "Invalid JSON format in pricing"
                });
            }
        }

        if (!pricing?.mrp || !pricing?.costPrice || !pricing?.sellingPrice) {
            return res.status(400).json({
                success: false,
                message: "MRP, Cost Price and Selling Price are required"
            });
        }
        if (pricing.costPrice && Number(pricing.costPrice) > Number(pricing.mrp)) {
            return res.status(400).json({
                success: false,
                message: "Cost price cannot be greater than MRP"
            });
        }
        if (pricing.sellingPrice > pricing.mrp) {
            return res.status(400).json({
                success: false,
                message: "Selling price cannot be greater than MRP"
            });
        }
        pricing.mrp = Number(pricing.mrp);
        pricing.costPrice = Number(pricing.costPrice);
        pricing.taxPercent = Number(pricing.taxPercent);
        pricing.sellingPrice = Number(pricing.sellingPrice);
        stock = Number(stock);

        if (pricing.mrp <= 0 || stock < 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid price or stock"
            });
        }
        color = color.toLowerCase().trim();
        size = size.toUpperCase().trim();

        /* ---------------- PRODUCT CHECK ---------------- */

        const product = await Product.findOne({
            _id: productId,
            isActive: true,
            status: "approved"
        }).select("sellerId categoryId")
            .populate("categoryId", "name")
            .lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product inactive Or Under QC"
            });
        }

        if (product.sellerId.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to add variants to this product"
            });
        }


        /* ---------------- DUPLICATE CHECK ---------------- */

        const existsVariant = await ProductVariant.findOne({
            productId,
            size,
            color
        }).select("sku color size").lean();
        if (existsVariant) {
            return res.status(409).json({
                success: false,
                message: `Variant already exists for this combination ( ${existsVariant.sku} )`,
                SKU: existsVariant.sku,
                color: existsVariant.color,
                size: existsVariant.size
            });
        }

        /* ---------------- SKU ---------------- */

        const sku = generateSKU(product, size, color);

        /* ---------------- CREATE ---------------- */

        const variant = await ProductVariant.create({
            productId,
            sellerId: product.sellerId,
            status: "pending",
            variantTitle,
            variantDiscription,
            color,
            size,
            pricing,
            stock,
            variantImages,
            sku
        });
        console.log(variant)

        return res.status(201).json({
            success: true,
            message: "Variant added & sent for QC",
            variant
        });

    } catch (error) {
        console.log(error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to add variant"
        });
    }
};




/* =========================
   UPDATE VARIANT (ADMIN)
   PUT /api/admin/variants/:id
========================= */
export const updateVariant = async (req, res) => {
    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid variant id"
            });
        }

        let { variantTitle, variantDiscription, pricing, size, color, stock } = req.body;

        const variant = await ProductVariant.findById(id);

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            });
        }

        if (variant.sellerId.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to update this variant"
            });
        }
        
        let variantImages = variant.variantImages;

        if (req.files?.length) {
            variantImages = req.files.map(
                file => `/uploads/${file.filename}`
            );
        }

        /* -------- PARSE PRICING -------- */

        if (typeof pricing === "string") {
            pricing = JSON.parse(pricing);
        }

        if (!pricing?.mrp || !pricing?.costPrice || !pricing?.sellingPrice) {
            return res.status(400).json({
                success: false,
                message: "MRP, Cost Price and Selling Price required"
            });
        }

        pricing.mrp = Number(pricing.mrp);
        pricing.costPrice = Number(pricing.costPrice);
        pricing.sellingPrice = Number(pricing.sellingPrice);
        pricing.taxPercent = Number(pricing.taxPercent);

        stock = Number(stock);

        if (pricing.costPrice > pricing.mrp) {
            return res.status(400).json({
                success: false,
                message: "Cost price cannot be greater than MRP"
            });
        }

        if (pricing.sellingPrice > pricing.mrp) {
            return res.status(400).json({
                success: false,
                message: "Selling price cannot be greater than MRP"
            });
        }

        color = color.toLowerCase().trim();
        size = size.toUpperCase().trim();

        /* -------- DUPLICATE CHECK -------- */

        const duplicate = await ProductVariant.findOne({
            _id: { $ne: id },
            productId: variant.productId,
            size,
            color
        });

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: "Variant already exists for this size & color"
            });
        }

        /* -------- IMAGES -------- */



        /* -------- CHECK CHANGES -------- */

        const isOnlyStockUpdate =
            Number(stock) !== variant.stock &&
            pricing.mrp === variant.pricing.mrp &&
            pricing.costPrice === variant.pricing.costPrice &&
            pricing.sellingPrice === variant.pricing.sellingPrice &&
            size === variant.size &&
            color === variant.color;

        const updatedVariant = await ProductVariant.findByIdAndUpdate(
            id,
            {
                variantTitle,
                variantDiscription,
                size,
                color,
                pricing,
                stock,
                variantImages,
                ...(isOnlyStockUpdate
                    ? {}
                    : { status: "pending", isActive: false })
            },
            { new: true, runValidators: true }
        );

        return res.json({
            success: true,
            message: isOnlyStockUpdate
                ? "Stock updated successfully"
                : "Variant updated & sent for QC",
            variant: updatedVariant
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Failed to update variant"
        });

    }
};
/* =========================
   GET VARIANTS BY PRODUCT
   GET /api/products/:productId/variants
========================= */
export const getVariantsByProduct = async (req, res) => {
    try {
        const variants = await ProductVariant.find({
            productId: req.params.productId,
            isActive: true
        }).sort({ price: 1 });

        return res.status(200).json({
            success: true,
            count: variants.length,
            variants
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch variants"
        });
    }
};


/* =========================
   GET SINGLE VARIANT
   GET /api/variant/:id
========================= */
export const getVariantById = async (req, res) => {
    try {
        const variant = await ProductVariant.findById(req.params.id)
            .populate("productId", "name productImage");

        if (!variant || !variant.isActive) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            });
        }

        return res.status(200).json({
            success: true,
            variant
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch variant"
        });
    }
};


/* =========================
   GET ALL VARIANTS (ADMIN)
   GET /api/admin/variants
========================= */
export const getAllVariants = async (req, res) => {
    try {

        const {
            search = "",
            page = 1,
            limit = 10
        } = req.query;

        const query = {};

        if (search) {
            query.$or = [
                { variantTitle: { $regex: search, $options: "i" } },
                { sku: { $regex: search, $options: "i" } },
                { hsnCode: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (page - 1) * limit;

        const [variants, total] = await Promise.all([

            ProductVariant.find(query)
                .populate("productId", "name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),

            ProductVariant.countDocuments(query)

        ]);

        return res.status(200).json({
            success: true,
            page: Number(page),
            limit: Number(limit),
            totalVariants: total,
            totalPages: Math.ceil(total / limit),
            variants
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: "Failed to fetch variants",
            error: error.message
        });

    }
};



/* =========================
   DELETE VARIANT (SOFT)
   DELETE /api/admin/variants/:id
========================= */
export const updateVariantStatusByAdmin = async (req, res) => {
    try {
        const { status, qcNote = "" } = req.body;

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value",
            });
        }

        const variant = await ProductVariant.findById(req.params.id);

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found",
            });
        }

        if (variant.status !== "pending") {
            return res.status(400).json({
                success: false,
                message:
                    "Review already completed for this variant.",
            });
        }

        if (status === "rejected" && !qcNote.trim()) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required",
            });
        }

        variant.status = status;
        variant.qcActionBy = req.user.id;
        variant.qcAt = new Date();
        variant.qcNote = status === "rejected" ? qcNote : "";
        variant.isActive = status === "approved";

        await variant.save();

        return res.json({
            success: true,
            message:
                status === "approved"
                    ? "Variant approved and now live"
                    : "Variant rejected successfully",
            variant,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update variant status",
        });
    }
};

/* =========================
   DELETE VARIANT (SOFT)
   DELETE /api/admin/variants/:id
========================= */
export const deleteVariant = async (req, res) => {
    try {
        const variant = await ProductVariant.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Variant deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to delete variant"
        });
    }
};
