import jwt from "jsonwebtoken";
import userModal from "../models/roleWiseModal/user.modal.js";

export const optionalAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await userModal
            .findById(decoded.id)
            .select("_id name email role forceLogout");

        if (!user) {
            return next();
        }

        req.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        next();

    } catch (error) {
        next();
    }
};