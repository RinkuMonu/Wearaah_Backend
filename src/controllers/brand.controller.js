import Brand from "../models/brand.modal.js";

/* =========================
   CREATE BRAND
========================= */
export const createBrand = async (req, res) => {
    try {
        const {
            name,
            tagline,
            description,
            brandType,
            gstNumber,
            supportEmail,
            supportPhone,
            countryOfOrigin,
            websiteUrl
        } = req.body;
        console.log(req.body)

        if (!name || !brandType || !tagline || !description || !gstNumber || !supportEmail || !supportPhone || !websiteUrl) {
            return res.status(400).json({ message: "Name, brandType, tagline, description, GST number, support email,websiteUrl, support phone are required" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "Brand logo is required" });
        }

        const existing = await Brand.exists({
            name,
        }).select("_id name");

        if (existing) {
            return res.status(409).json({ message: "Brand already exists" });
        }

        const brand = await Brand.create({
            ...req.body,
            logo: req.file.path,
            sellerId: req.user.id,
            createdBy: req.user.id,
        });

        res.status(201).json({
            success: true,
            message: "Brand created successfully",
            data: brand,
        });
    } catch (err) {
        console.error("Error creating brand:", err);
        res.status(500).json({ message: err.message });
    }
};

/* =========================
   GET ALL BRANDS
========================= */
export const getBrands = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            status
        } = req.query;

        const query = {};


        // ✅ ROLE BASED FILTER
        if (req.user.role === "seller") {
            query.sellerId = req.user.id;
        }

        // ✅ STATUS FILTER
        if (status) {
            query.status = status;
        }

        // ✅ GLOBAL SEARCH
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { tagline: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { gstNumber: { $regex: search, $options: "i" } },
                { supportEmail: { $regex: search, $options: "i" } },
                { supportPhone: { $regex: search, $options: "i" } },
                { countryOfOrigin: { $regex: search, $options: "i" } }
            ];
        }

        const brands = await Brand.find(query)
            .populate("sellerId", "name email")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Brand.estimatedDocumentCount(query)

        res.json({
            success: true,
            total,
            page: Number(page),
            limit: Number(limit),
            data: brands,
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
export const getBrandsNameID = async (req, res) => {
    try {
        let query = {}
        if (req.user.role === "seller") {
            query.sellerId = req.user.id;
        }

        const brands = await Brand.find(query)
            .sort({ createdAt: -1 })

        return res.json({
            success: true,
            data: brands,
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/* =========================
   GET SINGLE BRAND
========================= */
export const getSingleBrand = async (req, res) => {
    try {
        const brand = await Brand.findById(req.params.id)
            .populate("sellerId", "name email");

        if (!brand) {
            return res.status(404).json({ message: "Brand not found" });
        }

        res.json({ success: true, data: brand });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/* =========================
   UPDATE BRAND
========================= */
export const updateBrand = async (req, res) => {
    try {
        const brand = await Brand.findById(req.params.id);

        if (!brand) {
            return res.status(404).json({ message: "Brand not found" });
        }

        if (brand.sellerId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (req.file) {
            req.body.logo = req.file.path;
        }

        const updated = await Brand.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: "Brand updated",
            data: updated,
        });
    } catch (err) {
        console.log("update brand", err)
        res.status(500).json({ message: err.message });
    }
};

/* =========================
   DELETE BRAND
========================= */
export const deleteBrand = async (req, res) => {
    try {
        const brand = await Brand.findById(req.params.id);

        if (!brand) {
            return res.status(404).json({ message: "Brand not found" });
        }

        await brand.deleteOne();

        res.json({
            success: true,
            message: "Brand deleted successfully",
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/* =========================
   CHANGE STATUS (ADMIN)
========================= */
export const changeBrandStatus = async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;

        const brand = await Brand.findById(req.params.id);

        if (!brand) {
            return res.status(404).json({ message: "Brand not found" });
        }

        brand.status = status;

        if (status === "rejected") {
            brand.rejectionReason = rejectionReason;
            brand.rejectionDate = new Date();
        }

        if (status === "active") {
            brand.isActive = true;
            brand.approvedAt = new Date();
        }

        await brand.save();

        res.json({
            success: true,
            message: "Status updated",
            data: brand,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
