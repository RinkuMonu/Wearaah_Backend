import slugify from "slugify";
import { deleteLocalFile } from "../config/multer.js";
import SubCategory from "../models/subcategory.modal.js";

/* =========================
   CREATE CATEGORY
   POST /api/admin/categories
========================= */
export const subcreateCategory = async (req, res) => {
    try {
        const {
            name,
            categoryId,
            sizeType = "alpha",
            variantAttributes,
            displayOrder
        } = req.body;
        let disNumber = Number(displayOrder)
        const showOnHome = req.body.showOnHome === "true" || req.body.showOnHome === true;

        if (!name || !categoryId) {
            return res.status(400).json({
                success: false,
                message: "name and categoryId are required"
            });
        }

        const exists = await SubCategory.findOne({
            $or: [
                { name: name },
                { displayOrder: disNumber }
            ]
        }).select("name displayOrder").lean();

        if (exists?.name === name) {
            return res.status(409).json({
                success: false,
                message: "Category already exists"
            });
        }

        if (exists?.displayOrder === disNumber) {
            return res.status(409).json({
                success: false,
                message: "This displayOrder is already used by another category"
            });
        }

        // 🔹 PARSE ATTRIBUTES
        let attributes = {};
        if (req.body.attributes) {
            attributes =
                typeof req.body.attributes === "string"
                    ? JSON.parse(req.body.attributes)
                    : req.body.attributes;
        }

        // 🔹 PARSE VARIANT ATTRIBUTES
        let parsedVariantAttributes = [];
        if (variantAttributes) {
            parsedVariantAttributes =
                typeof variantAttributes === "string"
                    ? JSON.parse(variantAttributes)
                    : variantAttributes;
        }

        // 🔹 SLUG
        const slug = slugify(name, { lower: true, strict: true });
        // 🔹 IMAGES
        const bannerimage = req.files?.bannerimage?.[0]
            ? `/uploads/${req.files.bannerimage[0].filename}`
            : null;

        const smallimage = req.files?.smallimage?.[0]
            ? `/uploads/${req.files.smallimage[0].filename}`
            : null;

        const subCategory = await SubCategory.create({
            name,
            slug,
            categoryId,
            showOnHome: showOnHome,
            sizeType,
            attributes,
            variantAttributes: parsedVariantAttributes,
            bannerimage,
            smallimage
        });

        return res.status(201).json({
            success: true,
            subCategory
        });

    } catch (error) {
        console.log("SUBCATEGORY CREATE ERROR", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create subcategory"
        });
    }
};

/* =========================
   GET ALL CATEGORIES
   GET /api/categories
========================= */
export const subgetCategories = async (req, res) => {
    try {

        const {
            pareId,
            search,
            isActive,
            dateFrom,
            dateTo,
            page = 1,
            limit = 10,
            sort = "createdAt"
        } = req.query;

        const filter = {};


        if (isActive !== undefined) {
            filter.isActive = isActive === "true";
        }
        if (pareId) {
            filter.categoryId = pareId
        }

        // search
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ];
        }

        // date filter
        if (dateFrom || dateTo) {
            filter.createdAt = {};

            if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
            if (dateTo) filter.createdAt.$lte = new Date(dateTo);
        }

        const skip = (Number(page) - 1) * Number(limit);

        const categories = await SubCategory.find(filter).populate({
            path: "categoryId",
            select: "name"
        })
            .sort({ [sort]: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const total = await SubCategory.countDocuments(filter);

        return res.status(200).json({
            success: true,
            total,
            page: Number(page),
            limit: Number(limit),
            categories
        });

    } catch (error) {

        console.error("GET CATEGORY ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch categories"
        });

    }
};

export const getsubCategoriesOnlyIdName = async (req, res) => {
    try {
        const categories = await SubCategory.find()
            .sort()
            .select("name")
            .lean();
        return res.status(200).json({
            success: true,
            categories
        });

    } catch (error) {
        console.error("GET CATEGORY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch categories"
        });
    }

}



export const getSubCategoriesByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const subcategories = await SubCategory.find({
            categoryId: categoryId,
            isActive: true
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            subcategories
        });

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch subcategories"
        });
    }
};


/* =========================
   GET CATEGORY BY ID
   GET /api/categories/:id
========================= */
export const subgetCategoryById = async (req, res) => {
    try {
        const category = await SubCategory.findById(req.params.id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        return res.status(200).json({
            success: true,
            category
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch category"
        });
    }
};

/* =========================
   UPDATE CATEGORY
   PUT /api/admin/categories/:id
========================= */
export const subupdateCategory = async (req, res) => {
    try {
        const subCategory = await SubCategory.findById(req.params.id);

        if (!subCategory) {
            return res.status(404).json({
                success: false,
                message: "Subcategory not found"
            });
        }

        const updates = { ...req.body };

        // 🔹 NAME → SLUG UPDATE
        if (updates.name) {
            updates.slug = slugify(updates.name, {
                lower: true,
                strict: true
            });
        }
        if (req.body.displayOrder) updates.displayOrder = Number(req.body.displayOrder);
        if (req.body.showOnHome !== undefined) updates.showOnHome = req.body.showOnHome;


        // 🔹 ATTRIBUTES PARSE
        if (updates.attributes) {
            updates.attributes =
                typeof updates.attributes === "string"
                    ? JSON.parse(updates.attributes)
                    : updates.attributes;
        }

        // 🔹 VARIANT ATTRIBUTES PARSE
        if (updates.variantAttributes) {
            updates.variantAttributes =
                typeof updates.variantAttributes === "string"
                    ? JSON.parse(updates.variantAttributes)
                    : updates.variantAttributes;
        }

        // 🔹 IMAGE UPDATE
        if (req.files?.bannerimage?.[0]) {
            deleteLocalFile(subCategory.bannerimage);
            updates.bannerimage = `/uploads/${req.files.bannerimage[0].filename}`;
        }

        if (req.files?.smallimage?.[0]) {
            deleteLocalFile(subCategory.smallimage);
            updates.smallimage = `/uploads/${req.files.smallimage[0].filename}`;
        }

        const updated = await SubCategory.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            subCategory: updated
        });

    } catch (error) {
        console.log("SUBCATEGORY UPDATE ERROR", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update subcategory"
        });
    }
};

/* =========================
   DELETE CATEGORY (SOFT)
   DELETE /api/admin/categories/:id
========================= */
export const subdeleteCategory = async (req, res) => {
    try {
        const category = await SubCategory.findByIdAndDelete(
            req.params.id,
            { new: true }
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to delete category"
        });
    }
};
