import jwt from "jsonwebtoken";
import redis from "./redis.js";
import userModal from "../models/roleWiseModal/user.modal.js";

export const protect = async (req, res, next) => {
  try {
    // 1️⃣ Authorization header check
    if (!req.headers.authorization || !req.headers.authorization.startsWith("Bearer")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing"
      });
    }

    // 2️⃣ Token extract
    const token = req.headers.authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token not provided"
      });
    }

    // 3️⃣ Token verify
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4️⃣ User fetch from DB (fresh & safe)
    const user = await userModal.findById(decoded.id).select("_id name email role forceLogout");
    // console.log(user)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found or token invalid"
      });
    }

    if (user.forceLogout) {
      return res.status(401).json({
        success: false,
        code: "FORCE_LOGOUT",
        message: "session expired login again"
      });
    }
    let redisSession = null
    // if (redis) {
    //   redisSession = await redis.get(`USER_AUTH_SESSION:${user._id}`);
    //   if (!redisSession || redisSession !== decoded.sessionId) {
    //     return res.status(401).json({
    //       success: false,
    //       code: "FORCE_LOGOUT",
    //       message: "You are logged in another device"
    //     });
    //   }
    // }

    // 5️⃣ Attach to request
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    console.log(error.message)
    return res.status(500).json({
      success: false,
      message: "Authentication failed"
    });
  }
};
