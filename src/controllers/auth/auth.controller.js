import jwt from "jsonwebtoken";
import crypto from "crypto";
import redis from "../../middlewares/redis.js";
import otpModal from "../../models/otp.modal.js";
import Wishlist from "../../models/wishlist.model.js";
import { deleteLocalFile } from "../../config/multer.js";
import userModal from "../../models/roleWiseModal/user.modal.js";
import bcrypt from "bcryptjs/dist/bcrypt.js";
import sellerModal from "../../models/roleWiseModal/seller.modal.js";
import riderModal from "../../models/roleWiseModal/rider.modal.js";
import orderModal from "../../models/order.modal.js";
import walletSystemModal from "../../models/walletSystem.modal.js";
/* =========================
   JWT TOKEN GENERATOR
========================= */
export const generateToken = (user, sessionId) => {
    return jwt.sign(
        {
            id: user._id,
            role: user.role,
            email: user.email,
            sessionId
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
};




export const registerViaOtp = async (req, res) => {
    try {
        const { mobile, otp } = req.body;

        if (!mobile || !otp) {
            return res.status(400).json({
                success: false,
                message: "Mobile and OTP required"
            });
        }

        const otpRecord = await otpModal.findOne({ mobile, otp });

        if (!otpRecord || otpRecord.expiresAt < Date.now()) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP"
            });
        }

        // ✅ OTP valid → delete it
        await otpModal.deleteMany({ mobile });

        let user = await userModal.findOne({ mobile });

        // 🔥 NEW USER → AUTO REGISTER
        if (!user) {
            user = await userModal.create({
                mobile,
                role: "customer"
            });

            // ✅ wallet create
            await walletSystemModal.updateOne(
                { ownerId: user._id, ownerType: user.role },
                {
                    $setOnInsert: {
                        ownerId: user._id,
                        ownerType: user.role,
                        availableBalance: 0,
                        superCoinBalance: 0,
                        lockedBalance: 0,
                        currency: "INR",
                        status: "active"
                    }
                },
                { upsert: true }
            );
        } else {
            // ✅ existing user → wallet ensure
            await walletSystemModal.updateOne(
                { ownerId: user._id, ownerType: user.role },
                {
                    $setOnInsert: {
                        ownerId: user._id,
                        ownerType: user.role,
                        availableBalance: 0,
                        superCoinBalance: 0,
                        lockedBalance: 0,
                        currency: "INR",
                        status: "active"
                    }
                },
                { upsert: true }
            );
        }

        const sessionId = crypto.randomUUID();
        const token = generateToken(user, sessionId);
        // if (redis) {
        //     await redis.setex(
        //         `USER_AUTH_SESSION:${user._id}`,
        //         60 * 60 * 24 * 7,
        //         sessionId
        //     );
        // }
        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};




export const verifyOtp = async (req, res) => {
    try {
        const { mobile, otp } = req.body;

        if (!mobile || !otp) {
            return res.status(400).json({
                success: false,
                message: "Mobile and OTP are required"
            });
        }

        const otpRecord = await otpModal.findOne({ mobile });

        if (
            !otpRecord ||
            otpRecord.otp !== otp ||
            otpRecord.expiresAt < new Date()
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired OTP"
            });
        }

        let user = await userModel.findOne({ mobile });
        let isNewUser = false;

        // 🔥 NEW USER CASE
        if (!user) {
            user = await userModel.create({
                mobile,
                isProfileComplete: false
            });
            isNewUser = true;
        }

        const sessionId = crypto.randomUUID();
        const token = generateToken(user, sessionId);

        if (redis) {
            const SESSION_TTL = 60 * 60 * 24 * 7;
            await redis.setex(
                `USER_AUTH_SESSION:${user._id}`,
                SESSION_TTL,
                sessionId
            );
        }

        await otpModal.deleteOne({ mobile });

        return res.status(200).json({
            success: true,
            token,
            isNewUser,
            user: {
                id: user._id,
                mobile: user.mobile,
                name: user.name || null,
                email: user.email || null,
                role: user.role
            }
        });

    } catch (error) {
        console.error("VERIFY OTP ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "OTP verification failed"
        });
    }
};


export const login = async (req, res) => {
    try {
        const { email, mobile, password, otp } = req.body;

        if ((!email && !mobile) || (!password && !otp)) {
            return res.status(400).json({
                success: false,
                message: "Email or mobile and password or OTP are required"
            });
        }

        const query = email
            ? { email: email.toLowerCase().trim() }
            : { mobile: mobile.trim() };

        const user = await userModal.findOne(query).select("+password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Account inactive"
            });
        }

        if (user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: "Account blocked",
                reason: user.blockReason || null
            });
        }


        if (password) {
            if (!user.password) {
                return res.status(400).json({
                    success: false,
                    message: "Password login not available for this account, use OTP"
                });
            }

            const isMatch = await user.comparePassword(password);

            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid credentials"
                });
            }
        }


        if (otp) {
            const otpRecord = await otpModal.findOne({ mobile });

            if (
                !otpRecord ||
                otpRecord.otp !== Number(otp) ||
                otpRecord.expiresAt < new Date()
            ) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired OTP"
                });
            }

            await otpModal.deleteOne({ mobile });
        }

        const sessionId = crypto.randomUUID();
        const token = generateToken(user, sessionId);

        if (redis) {
            await redis.setex(
                `USER_AUTH_SESSION:${user._id}`,
                60 * 60 * 24 * 7,
                sessionId
            );
        }

        user.lastLogin = new Date();
        user.forceLogout = false;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                role: user.role,
                avatar: user.avatar || null
            }
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
};





export const logout = async (req, res) => {
    try {
        if (redis) {
            await redis.del(`USER_AUTH_SESSION:${req.user.id}`);
        }

        return res.json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Logout failed"
        });
    }
};



export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            name,
            email,
            mobile,
            currentPassword,
            newPassword
        } = req.body;

        const user = await userModal.findById(userId).select("+password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        if (user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: "Account is blocked"
            });
        }

        const updates = {};

        if (name) {
            if (!/^[a-zA-Z\s]{2,50}$/.test(name)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid name format"
                });
            }
            updates.name = name.trim();
        }

        if (email && email !== user.email) {

            const exists = await userModal.findOne({ email });

            if (exists) {
                return res.status(409).json({
                    success: false,
                    message: "Email already in use"
                });
            }

            updates.email = email.toLowerCase().trim();
            updates.isVerified = false;
        }

        /* =========================
           MOBILE
        ========================= */
        if (mobile && mobile !== user.mobile) {

            if (!/^[6-9]\d{9}$/.test(mobile)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid mobile number"
                });
            }

            const exists = await userModal.findOne({ mobile });

            if (exists) {
                return res.status(409).json({
                    success: false,
                    message: "Mobile already in use"
                });
            }

            updates.mobile = mobile;
            updates.isVerified = false;
        }

        /* =========================
           PASSWORD CHANGE
        ========================= */
        if (currentPassword && newPassword) {

            const isMatch = await bcrypt.compare(
                currentPassword,
                user.password
            );

            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: "Current password incorrect"
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "Password must be at least 6 characters"
                });
            }

            updates.password = newPassword;
        }

        if (req.file) {
            if (user.avatar) {
                deleteLocalFile(user.avatar);
            }

            updates.avatar = `/uploads/${req.file.filename}`;
        }


        const updatedUser = await userModal.findByIdAndUpdate(
            userId,
            updates,
            { new: true, runValidators: true }
        ).select("-password");


        // if (redis) {
        //     await redis.del(`USER_PROFILE_LIONESS:${userId}`);
        // }

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser
        });

    } catch (error) {
        console.error("UPDATE PROFILE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Profile update failed"
        });
    }
};

export const updateUserStatus = async (req, res) => {
    try {
        const userId = req.params.id;
        const { isBlocked, blockReason, isActive } = req.body;

        const user = await userModal.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const updates = {};

        if (isActive !== undefined) {
            updates.isActive = isActive;
            updates.forceLogout = true;
        }

        if (isBlocked !== undefined) {

            if (isBlocked && !blockReason) {
                return res.status(400).json({
                    success: false,
                    message: "Block reason is required when blocking a user"
                });
            }

            updates.isBlocked = isBlocked;
            updates.blockReason = isBlocked ? blockReason : null;
            updates.forceLogout = true;
        }

        const updatedUser = await userModal.findByIdAndUpdate(
            userId,
            updates,
            { new: true, runValidators: true }
        );

        if (redis) {
            await redis.del(`USER_PROFILE_LIONESS:${userId}`);
        }

        return res.status(200).json({
            success: true,
            message: "User status updated successfully",
            user: updatedUser
        });

    } catch (error) {
        console.error("UPDATE USER STATUS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "User status update failed"
        });
    }
};



export const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const redisKey = `USER_PROFILE:${userId}`;


        if (redis) {
            const cached = await redis.get(redisKey);
            if (cached) {
                return res.json({
                    success: true,
                    source: "redis",
                    ...JSON.parse(cached)
                });
            }
        }


        const user = await userModal.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        let roleData = {};


        if (user.role === "customer") {
            const [totalOrders, totalWishlist] = await Promise.all([
                orderModal.countDocuments({ customerId: userId }),
                Wishlist.countDocuments({ user: userId })
            ]);

            roleData = {
                totalOrders,
                totalWishlist
            };
        }


        if (user.role === "seller") {
            const seller = await sellerModal.findOne({ userId });

            roleData = {
                shopName: seller?.shopName,
                totalProducts: seller?.totalProducts,
                totalOrders: seller?.totalOrders,
                totalRevenue: seller?.totalRevenue,
                kycStatus: seller?.kycStatus,
                isApproved: seller?.isApproved
            };
        }

        /* ================= RIDER ================= */

        if (user.role === "delivery_partner") {
            const rider = await riderModal.findOne({ userId });

            roleData = {
                totalDeliveries: rider?.totalDeliveries,
                completedDeliveries: rider?.completedDeliveries,
                totalEarnings: rider?.totalEarnings,
                isOnline: rider?.isOnline,
                kycStatus: rider?.kycStatus
            };
        }

        const responseData = {
            user,
            roleData
        };


        if (redis) {
            await redis.setex(redisKey, 3600, JSON.stringify(responseData));
        }

        return res.json({
            role: user.role,
            success: true,
            source: "db",
            ...responseData
        });

    } catch (error) {
        console.error("GET PROFILE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch profile"
        });
    }
};



// admin controller // admin controller // admin controller // admin controller 
// admin controller // admin controller // admin controller // admin controller 
// admin controller // admin controller // admin controller // admin controller 
// admin controller // admin controller // admin controller // admin controller 


export const getAllUsers = async (req, res) => {
    try {

        const {
            page = 1,
            limit = 10,
            search,
            role,
            isActive,
            isBlocked,
            sortBy = "createdAt",
            order = "desc",
            startDate,
            endDate
        } = req.query;

        const skip = (page - 1) * limit;

        /* ================= FILTER ================= */

        let filter = {};

        if (role) filter.role = role;

        if (isActive !== undefined) filter.isActive = isActive === "true";

        if (isBlocked !== undefined) filter.isBlocked = isBlocked === "true";


        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }


        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { mobile: { $regex: search, $options: "i" } },
                { platformId: { $regex: search, $options: "i" } }
            ];
        }

        const sortOrder = order === "asc" ? 1 : -1;

        const users = await userModal
            .find(filter)
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(Number(limit));


        const totalUsers = await userModal.countDocuments(filter);

        return res.status(200).json({
            success: true,

            pagination: {
                totalUsers,
                currentPage: Number(page),
                totalPages: Math.ceil(totalUsers / limit),
                limit: Number(limit),
                hasNextPage: page * limit < totalUsers,
                hasPrevPage: page > 1
            },

            filters: {
                role,
                isActive,
                isBlocked,
                search
            },

            users
        });

    } catch (error) {
        console.error("GET ALL USERS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch users"
        });
    }
};

export const updateUserKycStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { action, reason } = req.body;

        if (!userId || !action) {
            return res.status(400).json({
                success: false,
                message: "userId and action are required"
            });
        }

        const user = await userModal.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        /* ================= ACTION HANDLER ================= */

        switch (action) {

            case "block":
                user.isBlocked = true;
                user.forceLogout = true;
                user.blockReason = reason || "Blocked by admin";
                user.isActive = false;
                break;

            case "unblock":
                user.isBlocked = false;
                user.blockReason = null;
                user.isActive = true;
                break;

            case "activate":
                user.isActive = true;
                break;

            case "deactivate":
                user.isActive = false;
                user.forceLogout = true;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid action"
                });
        }

        await user.save();

        /* ========= FORCE LOGOUT WHEN BLOCKED ========= */

        if (action === "block" && redis) {
            await redis.del(`USER_AUTH_SESSION:${user._id}`);
        }

        return res.status(200).json({
            success: true,
            message: `User ${action} successful`,
            user
        });

    } catch (error) {
        console.error("UPDATE USER STATUS ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update user status"
        });
    }
};
