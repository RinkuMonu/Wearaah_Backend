export const isSuperAdmin = (req, res, next) => {
  if (req.user.role !== "superadmin") {
    return res.status(403).json({
      success: false,
      message: "access denied it is only for superadmin"
    });
  }
  next();
};
export const isSeller = (req, res, next) => {
  if (req.user.role !== "seller") {
    return res.status(403).json({
      success: false,
      message: "access denied it is only for seller"
    });
  }
  next();
};
export const isRider = (req, res, next) => {
  if (req.user.role !== "rider") {
    return res.status(403).json({
      success: false,
      message: "access denied it is only for rider"
    });
  }
  next();
};



export const isBothRole = (req, res, next) => {
  if (req.user.role !== "seller" && req.user.role !== "superadmin") {
    return res.status(403).json({
      success: false,
      message: "access denied it is only for seller or super admin"
    });
  }
  next();
};