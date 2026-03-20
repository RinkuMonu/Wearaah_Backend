import Product from "../models/product.model.js";
import ProductVariant from "../models/productVariant.model.js";
import Category from "../models/category.model.js";
import SubCategory from "../models/subcategory.modal.js";
import brandModal from "../models/brand.modal.js";
import slugify from "slugify";
import mongoose from "mongoose";



const generateProductSlug = async (name, productId = null) => {

  const baseSlug = slugify(name, {
    lower: true,
    strict: true,
    trim: true
  });

  let slug = baseSlug;
  let counter = 1;

  while (
    await Product.exists({
      slug,
      ...(productId && { _id: { $ne: productId } })
    }).select("slug").lean()
  ) {
    slug = `${baseSlug}-${counter++}`;
  }

  return slug;
};
/* =========================
   CREATE PRODUCT
========================= */

export const createProduct = async (req, res) => {
  try {
    const {
      brandId,
      subCategoryId,
      wearTypeId,
      name,
      hsnCode,
      gender,
      status,
      description,
      specifications = {}
    } = req.body;


    /* =====================
       BASIC VALIDATION
    ====================== */
    if (!brandId || !subCategoryId || !name || !description || !hsnCode || !gender) {
      return res.status(400).json({
        success: false,
        message:
          "brandId, subCategoryId, name, hsnCode, gender description are required"
      });
    }
    const validStatus = status || "pending";
    if (!["draft", "pending"].includes(validStatus)) {
      return res.status(400).json({
        success: false,
        message: "Use only 'pending' or 'draft' status for product creation"
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product image is required"
      });
    }
    const productImage = req.files.map(file => `/uploads/${file.filename}`)

    /* =====================
     CATEGORY VALIDATION
  ====================== */
    const [subCategoryDoc, brandExist] = await Promise.all([
      SubCategory.findOne({ _id: subCategoryId }),
      brandModal.findOne({ _id: brandId, isActive: true })
    ]);

    if (!subCategoryDoc) {
      return res.status(400).json({
        success: false,
        message: "Invalid sub category for selected category"
      });
    }
    console.log(subCategoryDoc)
    if (!brandExist) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand or inactive"
      });
    }

    let parsedSpecifications = specifications;

    if (typeof specifications === "string") {
      try {
        parsedSpecifications = JSON.parse(specifications);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON format in specifications"
        });
      }
    }

    if (
      !parsedSpecifications ||
      typeof parsedSpecifications !== "object" ||
      Array.isArray(parsedSpecifications)
    ) {
      return res.status(400).json({
        success: false,
        message: "Specifications must be an object"
      });
    }

    const allowedAttributes = subCategoryDoc.attributes || new Map();

    for (const key of Object.keys(parsedSpecifications)) {

      const attributeConfig = allowedAttributes.get(key);
      console.log(attributeConfig)

      if (!attributeConfig) {
        return res.status(400).json({
          success: false,
          message: `Invalid specification key: ${key}`
        });
      }

      if (
        attributeConfig.values?.length &&
        !attributeConfig.values.includes(parsedSpecifications[key])
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid value for ${key}: ${parsedSpecifications[key]}`
        });
      }

    }

    for (const [key, config] of allowedAttributes.entries()) {
      if (config.required && !parsedSpecifications[key]) {
        return res.status(400).json({
          success: false,
          message: `${key} is required`
        });
      }
    }

    /* =====================
       CREATE PRODUCT
    ====================== */
    const slug = await generateProductSlug(req.body.name);
    const product = await Product.create({
      sellerId: req.user.id,
      wearTypeId,
      brandId,
      categoryId: subCategoryDoc.categoryId,
      subCategoryId,
      name: name.trim(),
      hsnCode,
      slug,
      gender,
      description,
      status: validStatus,
      specifications: parsedSpecifications,
      productImage
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully now add variants to make it live",
      product
    });

  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Product creation failed"
    });
  }
};


export const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      subCategory,
      brand,
      color,
      size,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 10,
      isTrending,
      isBestSelling,
      isTopRated
    } = req.query;

    // const isPrivileged =
    //   req.user?.role === "superAdmin" ||
    //   req.user?.role === "seller";
    const isPrivileged = false

    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const skip = (pageNumber - 1) * pageSize;

    /* ---------------- PRODUCT MATCH ---------------- */

    const productMatch = { isActive: true };

    if (search) {
      productMatch.name = { $regex: search, $options: "i" };
    }
    if (category)
      productMatch.categoryId = new mongoose.Types.ObjectId(category);

    if (subCategory)
      productMatch.subCategoryId = new mongoose.Types.ObjectId(subCategory);

    if (brand)
      productMatch.brandId = new mongoose.Types.ObjectId(brand);

    if (isTrending === "true") productMatch.isTrending = true;
    if (isBestSelling === "true") productMatch.isBestSelling = true;
    if (isTopRated === "true") productMatch.isTopRated = true;

    /* ---------------- VARIANT MATCH ---------------- */

    const variantMatch = {};

    // 👤 CUSTOMER
    if (!isPrivileged) {
      variantMatch.isActive = true;
      variantMatch.stock = { $gt: 0 };
      variantMatch.status = "approved"
    }
    if (req.user?.role === "seller") {
      variantMatch.sellerId = new mongoose.Types.ObjectId(req.user.id);
    }
    if (color)
      variantMatch["attributes.color"] = color.toLowerCase();

    if (size)
      variantMatch["attributes.size"] = size.toLowerCase();

    if (minPrice || maxPrice) {
      variantMatch["pricing.sellingPrice"] = {};
      if (minPrice)
        variantMatch["pricing.sellingPrice"].$gte = Number(minPrice);
      if (maxPrice)
        variantMatch["pricing.sellingPrice"].$lte = Number(maxPrice);
    }

    /* ---------------- PIPELINE ---------------- */

    const pipeline = [

      { $match: productMatch },

      /* ---------- VARIANTS LOOKUP ---------- */

      {
        $lookup: {
          from: "productvariants",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$productId", "$$productId"] },
                ...variantMatch
              }
            },
            {
              $project: {
                sellingPrice: "$pricing.sellingPrice",
                color: "$attributes.color",
                mrp: "$pricing.mrp",
              }
            }
          ],
          as: "variants"
        }
      },

      /* ---------- CUSTOMER → REMOVE EMPTY PRODUCTS ---------- */

      // ...(!isPrivileged
      //   ? [{ $match: { variants: { $ne: [] } } }]
      //   : []),

      /* ---------- CATEGORY LOOKUP ---------- */

      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category"
        }
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true
        }
      },
      // subcategory
      {
        $lookup: {
          from: "subcategories",
          localField: "subCategoryId",
          foreignField: "_id",
          as: "subCategory"
        }
      },
      {
        $unwind: {
          path: "$subCategory",
          preserveNullAndEmptyArrays: true
        }
      },

      /* ---------- BRAND LOOKUP ---------- */

      {
        $lookup: {
          from: "brands",
          localField: "brandId",
          foreignField: "_id",
          as: "brand"
        }
      },
      {
        $unwind: {
          path: "$brand",
          preserveNullAndEmptyArrays: true
        }
      },

      /* ---------- CALCULATED FIELDS ---------- */

      {
        $addFields: {
          startingPrice: { $min: "$variants.sellingPrice" },
          mrp: { $max: "$variants.mrp" },
          colors: { $setUnion: [[], "$variants.color"] },
          totalVariants: { $size: "$variants" },
          hasVariants: { $gt: [{ $size: "$variants" }, 0] }
        }
      },

      /* ---------- RESPONSE SHAPE ---------- */

      {
        $project: {
          name: 1,
          productImage: 1,
          subCategoryId: 1,
          description: 1,

          gender: 1,
          category: "$category.name",
          taxPercent: "$category.taxPercent",
          brand: "$brand.name",
          sizeType: "$subCategory.sizeType",
          specifications: 1,
          rating: 1,
          isNewArrival: 1,
          isTrending: 1,
          isBestSelling: 1,
          isTopRated: 1,

          mrp: 1,
          startingPrice: 1,
          colors: 1,
          totalVariants: 1,
          hasVariants: 1
        }
      }
    ];

    /* ---------------- SORT ---------------- */

    if (sort === "price_low")
      pipeline.push({ $sort: { startingPrice: 1 } });

    if (sort === "price_high")
      pipeline.push({ $sort: { startingPrice: -1 } });

    /* ---------------- PAGINATION ---------------- */

    pipeline.push({
      $facet: {
        data: [{ $skip: skip }, { $limit: pageSize }],
        totalCount: [{ $count: "count" }]
      }
    });

    const result = await Product.aggregate(pipeline);

    const products = result[0].data;
    const totalCount = result[0].totalCount[0]?.count || 0;

    return res.json({
      success: true,
      count: totalCount,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalCount / pageSize),
      products
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products"
    });
  }
};



/* =========================
   GET PRODUCT BY ID
   GET /api/products/:id
========================= */
export const getProductById = async (req, res) => {
  try {
    let product
    if (req.params.id) {
      product = await Product.findOne({
        _id: req.params.id,
        isActive: true
      });
    } else {
      product = await Product.findOne({
        slug: req.params.slug,
        isActive: true
      });

    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // 🔥 Only in-stock variants
    const variants = await ProductVariant.find({
      productId: product._id,
      isActive: true,
      stock: { $gt: 0 }
    });

    return res.status(200).json({
      success: true,
      product,
      variants
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product"
    });
  }
};

/* =========================
   UPDATE PRODUCT
   PUT /api/admin/products/:id 
========================= */
export const updateProduct = async (req, res) => {
  try {

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (product.sellerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const updates = {};

    const editableFields = [
      "name",
      "description",
      "specifications",
      "returnPolicyDays"
    ];

    editableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    /* ------------ IMAGE ------------ */

    if (req.files?.length) {
      updates.productImage = req.files.map(
        file => `/uploads/${file.filename}`
      );
    }

    /* ------------ SLUG ------------ */

    if (updates.name && updates.name !== product.name) {
      updates.slug = await generateProductSlug(updates.name, product._id);
    }

    if (req.body.specifications !== undefined) {
      let specs = req.body.specifications;
      // console.log(typeof specs)

      if (typeof specs === "string") {
        try {
          specs = JSON.parse(specs);
        } catch {
          return res.status(400).json({
            success: false,
            message: "Invalid JSON format in specifications"
          });
        }
      }

      updates.specifications = specs;
    }

    /* ------------ STATUS LOGIC ------------ */

    if (req.body.status === "draft") {
      updates.status = "draft";
    } else {
      updates.status = "pending";
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      updates,
      { new: true, runValidators: true }
    );

    return res.json({
      success: true,
      message:
        updates.status === "draft"
          ? "Saved as draft"
          : "Product sent for QC",
      product: updatedProduct
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || "Update failed" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete product"
    });
  }
};



export const getFilters = async (req, res) => {
  try {
    const { categoryId } = req.query;

    // 🔹 ALL PRODUCTS PAGE
    if (!categoryId) {
      return res.json({
        success: true,
        filters: {
          allowed: [
            "price",
            "brand",
            "color",
            "size",
            "discount",
            "availability",
            "rating"
          ],
          attributes: {}
        }
      });
    }

    // 🔹 CATEGORY PAGE
    const category = await Category.findById(categoryId).select(
      "allowedFilters attributeFilters"
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    return res.json({
      success: true,
      filters: {
        allowed: category.allowedFilters,
        attributes: category.attributeFilters
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch filters"
    });
  }
};


export const adminUpdateProduct = async (req, res) => {
  try {

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const allowedFields = [
      "status",
      "isActive",
      "isTrending",
      "isBestSelling",
      "isTopRated",
      "returnPolicyDays"
    ];

    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      updates,
      { new: true }
    );

    return res.json({
      success: true,
      message: "Product updated by admin",
      product: updatedProduct
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Admin update failed" });
  }
};