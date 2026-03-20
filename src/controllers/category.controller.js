import { deleteLocalFile } from "../config/multer.js";
import Category from "../models/category.model.js";

/* =========================
   CREATE CATEGORY
   POST /api/admin/categories
========================= */
export const createCategory = async (req, res) => {
    try {
        const { name, description, displayOrder } = req.body;
        if (!req.files.bannerimage || !req.files.smallimage || !name || !description) {
            return res.status(400).json({
                success: false,
                message: "name, description, Banner image and small image are required"
            });
        }
        const showOnHome = req.body.showOnHome === "true" || req.body.showOnHome === true;
        let disNumber = Number(displayOrder)


        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Name are required"
            });
        }

        const exists = await Category.findOne({
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
        const bannerimage = req.files?.bannerimage?.[0]
            ? `/uploads/${req.files.bannerimage[0].filename}`
            : null;

        const smallimage = req.files?.smallimage?.[0]
            ? `/uploads/${req.files.smallimage[0].filename}`
            : null;
        const category = await Category.create({
            createBy: req.user.id,
            name,
            showOnHome: showOnHome,
            displayOrder: disNumber,
            description,
            bannerimage,
            smallimage
        });

        return res.status(201).json({
            success: true,
            category
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create category"
        });
    }
};


/* =========================
   GET ALL CATEGORIES
   GET /api/categories
========================= */
export const getCategories = async (req, res) => {
    try {

        const {
            search,
            isActive,
            showOnHome,
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

        if (showOnHome !== undefined) {
            filter.showOnHome = showOnHome === "true";
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

        const categories = await Category.find(filter)
            // .populate("wearTypeId", "name")
            .sort({ [sort]: -1 })
            .skip(skip)
            .limit(Number(limit))
            .select("name slug description showOnHome isActive displayOrder smallimage bannerimage createdAt")
            .lean();

        const total = await Category.countDocuments(filter);

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
export const getCategoriesOnlyIdName = async (req, res) => {
    try {
        const categories = await Category.find()
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
};
/* =========================
   GET CATEGORY BY ID
   GET /api/categories/:id
========================= */
export const getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

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
export const updateCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }
        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.body.displayOrder) updates.displayOrder = Number(req.body.displayOrder);
        if (req.body.description) updates.description = req.body.description;
        if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
        if (req.body.showOnHome !== undefined) updates.showOnHome = req.body.showOnHome;

        if (req.files?.bannerimage?.[0]) {
            deleteLocalFile(category.bannerimage);
            updates.bannerimage = `/uploads/${req.files.bannerimage[0].filename}`;
        }

        if (req.files?.smallimage?.[0]) {
            deleteLocalFile(category.smallimage);
            updates.smallimage = `/uploads/${req.files.smallimage[0].filename}`;
        }
        const exists = await Category.findOne({
            _id: { $ne: req.params.id },
            $or: [
                { name: updates.name },
                { displayOrder: updates.displayOrder }
            ]
        }).select("name displayOrder").lean();

        if (exists?.name === updates.name) {
            return res.status(409).json({
                success: false,
                message: "Category name already exists"
            });
        }

        if (exists?.displayOrder === updates.displayOrder) {
            return res.status(409).json({
                success: false,
                message: "This displayOrder is already used"
            });
        }


        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            updatedCategory
        });

    } catch (error) {
        console.error("UPDATE CATEGORY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update category"
        });
    }
};


/* =========================
   DELETE CATEGORY (SOFT)
   DELETE /api/admin/categories/:id
========================= */
export const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
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
