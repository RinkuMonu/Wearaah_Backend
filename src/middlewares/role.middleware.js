import sellerModal from "../models/roleWiseModal/seller.modal.js";

export const isSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({
      success: false,
      message: "access denied it is only for superadmin"
    });
  }
  next();
};
export const isSeller = (req, res, next) => {
  if (req.user?.role !== "seller") {
    return res.status(403).json({
      success: false,
      message: "access denied it is only for seller"
    });
  }
  next();
};
export const isRider = (req, res, next) => {
  if (req.user?.role !== "rider") {
    return res.status(403).json({
      success: false,
      message: "access denied it is only for rider"
    });
  }
  next();
};



export const isBothRole = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;
    if (!["seller", "superadmin"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only seller or super admin allowed"
      });
    }

    if (role === "seller") {
      const seller = await sellerModal.findOne({ userId }).select("isApproved kycStatus");

      if (!seller || seller.isApproved === false || seller.kycStatus === "pending") {
        return res.status(403).json({
          code: "FORCE_LOGOUT",
          success: false,
          message: "Your account has not been approved yet. Please wait until it is approved."
        });
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Middleware error"
    });
  }
};