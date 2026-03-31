import mongoose from "mongoose";
import Product from "../models/product.model.js";
import ProductVariant from "../models/productVariant.model.js";
import Wishlist from "../models/wishlist.model.js";

/* =========================
   ADD VARIANT (ADMIN)
   POST /api/admin/products/:productId/variants
========================= */

const formatCode = (value = "") =>
  value.toString().replace(/\s+/g, "").toUpperCase().slice(0, 4);
const generateSKU = (product, size, color) => {
  const brandCode = "WEAR";
  const categoryCode = formatCode(product?.categoryId?.name || "GEN");
  const sizeCode = formatCode(size || "STD");
  const colorCode = formatCode(color || "DEF");
  const uniqueCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${brandCode}-${categoryCode}-${colorCode}-${sizeCode}-${uniqueCode}`;
};

// export const addVariant = async (req, res) => {
//     try {
//         const { productId } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(productId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid product ID"
//             });
//         }
//         let { stock, variantTitle, variantDiscription, pricing, size, color, } = req.body;

//         if (!variantTitle || !size || !color) {
//             return res.status(400).json({
//                 success: false,
//                 message: "variantTitle, size, color, cannot be empty"
//             });
//         }

//         /* ---------------- IMAGES ---------------- */

//         const variantImages = req.files?.map(
//             file => `/uploads/${file.filename}`
//         ) || [];

//         if (!variantImages || variantImages.length < 3) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Minimum 3 variant images are required"
//             });
//         }

//         /* ---------------- PARSE PRICING ---------------- */

//         if (typeof pricing === "string") {
//             try {
//                 pricing = JSON.parse(pricing);
//             } catch {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Invalid JSON format in pricing"
//                 });
//             }
//         }

//         if (!pricing?.mrp || !pricing?.costPrice || !pricing?.sellingPrice) {
//             return res.status(400).json({
//                 success: false,
//                 message: "MRP, Cost Price and Selling Price are required"
//             });
//         }
//         if (pricing.costPrice && Number(pricing.costPrice) > Number(pricing.mrp)) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Cost price cannot be greater than MRP"
//             });
//         }
//         if (pricing.sellingPrice > pricing.mrp) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Selling price cannot be greater than MRP"
//             });
//         }
//         pricing.mrp = Number(pricing.mrp);
//         pricing.costPrice = Number(pricing.costPrice);
//         pricing.taxPercent = Number(pricing.taxPercent);
//         pricing.sellingPrice = Number(pricing.sellingPrice);
//         stock = Number(stock);

//         if (pricing.mrp <= 0 || stock < 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid price or stock"
//             });
//         }
//         color = color.toLowerCase().trim();
//         size = size.toUpperCase().trim();

//         /* ---------------- PRODUCT CHECK ---------------- */

//         const product = await Product.findOne({
//             _id: productId,
//             isActive: true,
//             status: "approved"
//         }).select("sellerId categoryId")
//             .populate("categoryId", "name")
//             .lean();

//         if (!product) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Product inactive Or Under QC"
//             });
//         }

//         if (product.sellerId.toString() !== req.user.id.toString()) {
//             return res.status(403).json({
//                 success: false,
//                 message: "You are not allowed to add variants to this product"
//             });
//         }

//         /* ---------------- DUPLICATE CHECK ---------------- */

//         const existsVariant = await ProductVariant.findOne({
//             productId,
//             size,
//             color
//         }).select("sku color size").lean();
//         if (existsVariant) {
//             return res.status(409).json({
//                 success: false,
//                 message: `Variant already exists for this combination ( ${existsVariant.sku} )`,
//                 SKU: existsVariant.sku,
//                 color: existsVariant.color,
//                 size: existsVariant.size
//             });
//         }

//         /* ---------------- SKU ---------------- */

//         const sku = generateSKU(product, size, color);

//         /* ---------------- CREATE ---------------- */

//         const variant = await ProductVariant.create({
//             productId,
//             sellerId: product.sellerId,
//             status: "pending",
//             variantTitle,
//             variantDiscription,
//             color,
//             size,
//             pricing,
//             stock,
//             variantImages,
//             sku
//         });
//         console.log(variant)

//         return res.status(201).json({
//             success: true,
//             message: "Variant added & sent for QC",
//             variant
//         });

//     } catch (error) {
//         console.log(error);

//         if (error.code === 11000) {
//             return res.status(409).json({
//                 success: false,
//                 message: error.message
//             });
//         }

//         return res.status(500).json({
//             success: false,
//             message: error.message || "Failed to add variant"
//         });
//     }
// };

export const addVariant = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    let { variantTitle, variantDiscription, pricing, size, sizes, color } =
      req.body;

    if (typeof sizes === "string") {
      try {
        sizes = JSON.parse(sizes);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid sizes format",
        });
      }
    }
    // console.log(req.body)

    const isMultiSize = Array.isArray(sizes) && sizes.length > 0;

    if (!variantTitle || (!size && !isMultiSize) || !color) {
      return res.status(400).json({
        success: false,
        message: "variantTitle, size/sizes, color cannot be empty",
      });
    }

    /* ---------------- IMAGES ---------------- */

    const variantImages =
      req.files?.map((file) => `/uploads/${file.filename}`) || [];

    if (!variantImages || variantImages.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Minimum 3 variant images are required",
      });
    }

    /* ================= MULTI SIZE FLOW ================= */
    let product;
    if (isMultiSize) {
      product = await Product.findOne({
        _id: productId,
        isActive: true,
        status: "approved",
      })
        .select("sellerId categoryId")
        .populate("categoryId", "name")
        .lean();

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product inactive Or Under QC",
        });
      }

      if (product.sellerId.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to add variants to this product",
        });
      }

      color = color.toLowerCase().trim();

      const variantsToCreate = [];

      for (let item of sizes) {
        let sizeVal = item.size ? item.size.toUpperCase().trim() : null;
        if (!sizeVal) continue;

        let itemPricing = item.pricing;

        if (typeof itemPricing === "string") {
          try {
            itemPricing = JSON.parse(itemPricing);
          } catch {
            continue;
          }
        }

        if (
          !itemPricing?.mrp ||
          !itemPricing?.costPrice ||
          !itemPricing?.sellingPrice
        )
          continue;

        if (Number(itemPricing.costPrice) > Number(itemPricing.mrp)) continue;
        if (Number(itemPricing.sellingPrice) > Number(itemPricing.mrp))
          continue;

        itemPricing.mrp = Number(itemPricing.mrp);
        itemPricing.costPrice = Number(itemPricing.costPrice);
        itemPricing.taxPercent = Number(itemPricing.taxPercent || 0);
        itemPricing.sellingPrice = Number(itemPricing.sellingPrice);

        let itemStock = Number(item.stock);
        if (itemStock < 0) continue;

        const existsVariant = await ProductVariant.findOne({
          productId,
          size: sizeVal,
          color,
        });

        if (existsVariant) continue;

        const sku = generateSKU(product, sizeVal, color);

        variantsToCreate.push({
          productId,
          sellerId: product.sellerId,
          status: "pending",
          variantTitle,
          variantDiscription,
          color,
          size: sizeVal,
          pricing: itemPricing,
          stock: itemStock,
          variantImages,
          sku,
        });
      }

      if (variantsToCreate.length === 0) {
        return res.status(409).json({
          success: false,
          message: "All variants already exist or invalid data",
        });
      }

      const createdVariants = await ProductVariant.insertMany(variantsToCreate);
      product.isNewVariantAdd = true;
      const sizesToAdd = variantsToCreate.map((v) => v.size);
      const colorToAdd = color;

      await Product.findByIdAndUpdate(productId, {
        $addToSet: {
          sizeValue: { $each: sizesToAdd },
          colorValue: colorToAdd,
        },
        $set: {
          isNewVariantAdd: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Variants added successfully",
        variants: createdVariants,
      });
    }
  } catch (error) {
    console.log(error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add variant",
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
        message: "Invalid variant id",
      });
    }

    let { variantTitle, variantDiscription, pricing, size, color, stock } =
      req.body;

    const variant = await ProductVariant.findById(id);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    if (variant.sellerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this variant",
      });
    }

    let variantImages = variant.variantImages;

    if (req.files?.length) {
      variantImages = req.files.map((file) => `/uploads/${file.filename}`);
    }

    /* -------- PARSE PRICING -------- */

    if (typeof pricing === "string") {
      pricing = JSON.parse(pricing);
    }

    if (!pricing?.mrp || !pricing?.costPrice || !pricing?.sellingPrice) {
      return res.status(400).json({
        success: false,
        message: "MRP, Cost Price and Selling Price required",
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
        message: "Cost price cannot be greater than MRP",
      });
    }

    if (pricing.sellingPrice > pricing.mrp) {
      return res.status(400).json({
        success: false,
        message: "Selling price cannot be greater than MRP",
      });
    }

    color = color.toLowerCase().trim();
    size = size.toUpperCase().trim();

    /* -------- DUPLICATE CHECK -------- */

    const duplicate = await ProductVariant.findOne({
      _id: { $ne: id },
      productId: variant.productId,
      size,
      color,
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Variant already exists for this size & color",
      });
    }

    /* -------- IMAGES -------- */

    /* -------- CHECK CHANGES -------- */
    const isImagesChanged = req.files?.length > 0;

    const isOnlyStockUpdate =
      Number(stock) !== variant.stock &&
      pricing.mrp === variant.pricing.mrp &&
      pricing.costPrice === variant.pricing.costPrice &&
      pricing.sellingPrice === variant.pricing.sellingPrice &&
      size === variant.size &&
      color === variant.color &&
      !isImagesChanged;

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
        ...(isOnlyStockUpdate ? {} : { status: "pending" }),
      },
      { new: true, runValidators: true },
    );
    if (isImagesChanged) {
      await Product.findByIdAndUpdate(
        { _id: variant.productId },
        { isNewVariantAdd: true },
        { new: true },
      );
    }

    return res.json({
      success: true,
      message: isOnlyStockUpdate
        ? "Stock updated successfully"
        : "Variant updated & sent for QC",
      variant: updatedVariant,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update variant",
    });
  }
};

/// update only Stock/ bulk stock using bulkwrite
/// update only Stock/ bulk stock using bulkwrite

export const updateVariantStock = async (req, res) => {
  try {
    const { variants } = req.body;

    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Variants array required",
      });
    }

    const bulkOps = [];

    for (let item of variants) {
      if (!mongoose.Types.ObjectId.isValid(item.id)) continue;

      const newStock = Number(item.stock);

      if (isNaN(newStock) || newStock < 0) continue;

      bulkOps.push({
        updateOne: {
          filter: { _id: item.id },
          update: { stock: newStock },
        },
      });
    }

    if (bulkOps.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid variants to update",
      });
    }

    await ProductVariant.bulkWrite(bulkOps);

    return res.status(200).json({
      success: true,
      message: "Stock updated successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update stock",
    });
  }
};
/* =========================
   GET VARIANTS BY PRODUCT
   GET /api/products/:productId/variants
========================= */
export const getVariantsByProduct = async (req, res) => {
    try {
        const userId = req.user?.id;
        const variants = await ProductVariant.find({
            productId: req.params.productId,
            isActive: true,
            status: "approved",
        }).select("-pricing.costPrice").sort({ price: 1 }).lean();

        let wishSet = new Set();

        if (userId) {
            const wishlist = await Wishlist.find({ userId })
                .select("variantId")
                .lean();

            wishSet = new Set(
                wishlist.map(w => w.variantId.toString())
            );
        }

        const updatedVariants = variants.map(v => ({
            ...v,
            isWishlisted: wishSet.has(v._id.toString())
        }));

        return res.status(200).json({
            success: true,
            count: updatedVariants.length,
            variants: updatedVariants
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
    const variant = await ProductVariant.findById(req.params.id).populate(
      "productId",
      "name productImage",
    );

    if (!variant || !variant.isActive) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    return res.status(200).json({
      success: true,
      variant,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch variant",
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
      limit = 10,
      sort = "newest",
      color,
      size,
      minPrice,
      maxPrice,
      lowStock,
      category,
      status,
    } = req.query;

    const query = {};

    /* ---------------- SEARCH ---------------- */
    if (search) {
      query.$or = [
        { variantTitle: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { hsnCode: { $regex: search, $options: "i" } },
      ];
    }

    /* ---------------- FILTERS ---------------- */
    if (color) query.color = color.toLowerCase();
    if (size) query.size = size.toUpperCase();
    if (status) query.status = status.toLowerCase();

    if (minPrice || maxPrice) {
      query["pricing.sellingPrice"] = {};
      if (minPrice) query["pricing.sellingPrice"].$gte = Number(minPrice);
      if (maxPrice) query["pricing.sellingPrice"].$lte = Number(maxPrice);
    }

    if (lowStock === "true") {
      query.stock = { $lte: 5 };
    }

    /* ---------------- SORT ---------------- */
    let sortOption = { createdAt: -1 };

    switch (sort) {
      case "stock_asc":
        sortOption = { stock: 1 };
        break;
      case "stock_desc":
        sortOption = { stock: -1 };
        break;
      case "price_asc":
        sortOption = { "pricing.sellingPrice": 1 };
        break;
      case "price_desc":
        sortOption = { "pricing.sellingPrice": -1 };
        break;
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const skip = (page - 1) * limit;

    const [variantsRaw, total] = await Promise.all([
      ProductVariant.find(query)
        .populate({
          path: "productId",
          match: category ? { subCategoryId: category } : {},
          select: "name category",
        })
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      ProductVariant.countDocuments(query),
    ]);

    const variants = variantsRaw.filter((v) => v.productId !== null);
    const totalVariants = await ProductVariant.countDocuments();
    const inStock = await ProductVariant.countDocuments({
      stock: { $gt: 5 },
    });

    const lowStockCount = await ProductVariant.countDocuments({
      stock: { $gt: 0, $lte: 5 },
    });

    const outOfStock = await ProductVariant.countDocuments({
      stock: 0,
    });

    const pendingQC = await ProductVariant.countDocuments({
      status: "pending",
      isActive: true,
    });

    return res.status(200).json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      totalVariants: variants.length,
      totalPages: Math.ceil(total / limit),
      variants,
      stats: {
        total: totalVariants,
        inStock,
        lowStock: lowStockCount,
        outOfStock,
        pendingQC,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch variants",
      error: error.message,
    });
  }
};
export const getAllQcVariants = async (req, res) => {
  try {
    const { productId } = req.params;

    // 🔥 Fetch pending variants for this product
    const variants = await ProductVariant.find({
      productId,
      status: "pending",
    }).lean();

    // 🔴 If no variants found
    if (!variants.length) {
      return res.status(404).json({
        success: false,
        message: "No QC variants found for this product",
      });
    }

    return res.json({
      success: true,
      count: variants.length,
      variants,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch variants",
      error: error.message,
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
        message: "Review already completed for this variant.",
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
    // variant.isActive = status === "approved";
    if (status === "approved") {
      // ✅ check if any pending variants still exist
      const pendingVariants = await ProductVariant.countDocuments({
        productId: variant.productId,
        status: "pending",
      });

      // ✅ if NO pending variants → update product
      if (pendingVariants === 0) {
        await Product.findByIdAndUpdate(
          variant.productId,
          { isNewVariantAdd: false },
          { new: true },
        );
      }
    }

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
      { new: true },
    );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Variant deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete variant",
    });
  }
};
