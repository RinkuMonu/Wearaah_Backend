import Banner from "../models/banner.model.js";
/* =========================
   CREATE BANNER
   POST /api/banner
========================= */
export const createBanner = async (req, res) => {
  try {
    const {
      bannerName,
      description,
      deviceType,
      position,
      category,
      subcategory,
      redirectType,
      ctaText,
      displayOrder,
      startDate,
      endDate,
      targetGender,
    } = req.body;

    // ✅ validation
    if (!bannerName) {
      return res.status(400).json({
        success: false,
        message: "Banner name is required",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }
console.log(req.file);

    // ✅ single image
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Banner image is required",
      });
    }

    const banner = await Banner.create({
      bannerName,
      description,
      deviceType: deviceType || "both",
      position: position || "homepage-top",
      category,
      subcategory: subcategory || null,
      redirectType: redirectType || "none",
      ctaText: ctaText || "Shop Now",
      displayOrder: displayOrder || 0,
      startDate: startDate || null,
      endDate: endDate || null,
      targetGender: targetGender || "all",

      images: image, 

      addedBy: req.user?.id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Banner created successfully",
      banner,
    });
  } catch (error) {
    console.error("Create Banner Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create banner",
      error: error.message,
    });
  }
};

/* =========================
   GET ALL BANNERS
   GET /api/banner
========================= */

export const getBanners = async (req, res) => {
  try {
    const { deviceType, position, targetGender } = req.query;

    const filter = { isActive: true };

    if (deviceType) {
      filter.deviceType = { $in: [deviceType, "both"] };
    }

    if (position) {
      filter.position = position;
    }

    if (targetGender) {
      filter.targetGender = targetGender;
    }

    const banners = await Banner.find(filter)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .sort({ createdAt: -1 });
 
    return res.status(200).json({
      success: true,
      banners,  
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
    });
  }
};

/* =========================
   GET BANNER BY ID
   GET /api/banner/:id
========================= */
export const getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    return res.status(200).json({
      success: true,
      banner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch banner",
    });
  }
};

/* =========================
   UPDATE BANNER
   PUT /api/banner/:id
========================= */
export const updateBanner = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (req.files && req.files.length > 0) {
      updates.images = req.files.map((file) => `/uploads/${file.filename}`);
    }

    const banner = await Banner.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    return res.status(200).json({
      success: true,
      banner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update banner",
    });
  }
};

/* =========================
   DELETE BANNER (SOFT)
   DELETE /api/banner/:id
========================= */
export const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete banner",
    });
  }
};
