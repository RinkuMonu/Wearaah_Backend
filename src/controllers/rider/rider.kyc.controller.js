import mongoose from "mongoose";
import otpModal from "../../models/otp.modal.js";
import riderModal from "../../models/roleWiseModal/rider.modal.js";
import userModal from "../../models/roleWiseModal/user.modal.js";
import walletSystemModal from "../../models/walletSystem.modal.js";
import { sendSellerEmail } from "../../service/mailsend.js";
import { generateToken } from "../auth/auth.controller.js";


const buildNestedObject = (data = {}, parent) => {
    const result = {};
    Object.keys(data).forEach(key => {
        if (key.startsWith(parent + ".")) {
            const field = key.replace(parent + ".", "");
            result[field] = data[key];
        }
    });
    return result;
};


export const getAllRiders = async (req, res) => {
    try {
        let {
            page = 1,
            limit = 10,
            search,
            city,
            vehicleType,
            kycStatus,
            status,
            availabilityStatus,
            kycStep,
            sortBy = "createdAt",
            order = "desc",
            onlyPendingAndSubmit = false
        } = req.query;


        page = parseInt(page);
        limit = parseInt(limit);

        const skip = (page - 1) * limit;

        // 🔥 Build match filter
        const matchFilter = {};
        if (onlyPendingAndSubmit) {
            matchFilter.kycStatus = { $in: ["submitted", "pending", "rejected"] };
        } else {
            matchFilter.kycStatus = "verified"
            if (onlyPendingAndSubmit === "false") {
                matchFilter["user.isActive"] = true
            }
        }

        if (city) matchFilter.city = city;
        if (kycStep) matchFilter.kycStep = Number(kycStep);
        if (vehicleType) matchFilter.vehicleType = vehicleType;
        if (kycStatus) matchFilter.kycStatus = kycStatus;
        if (status) matchFilter["user.isActive"] = status === "active" ? true : false;
        if (availabilityStatus) matchFilter.availabilityStatus = availabilityStatus;

        // 🔥 Aggregation pipeline
        const result = await riderModal.aggregate([
            // 🔹 Join user data
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $unwind: {
                    path: "$user",
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $match: matchFilter
            },

            ...(search
                ? [{
                    $match: {
                        $or: [
                            { riderCode: { $regex: search, $options: "i" } },
                            { vehicleNumber: { $regex: search, $options: "i" } },
                            { drivingLicenseNumber: { $regex: search, $options: "i" } },
                            { "user.name": { $regex: search, $options: "i" } },
                            { "user.email": { $regex: search, $options: "i" } },
                            { "user.mobile": { $regex: search, $options: "i" } },
                            { "user.platformId": { $regex: search, $options: "i" } }
                        ]
                    }
                }]
                : []),

            {
                $facet: {
                    riders: [
                        {
                            $project: {
                                riderCode: 1,
                                city: 1,
                                vehicleType: 1,
                                vehicleNumber: 1,
                                drivingLicenseNumber: 1,
                                kycStatus: 1,
                                isApproved: 1,
                                kycStep: 1,
                                status: 1,
                                createdAt: 1,
                                availabilityStatus: 1,
                                "user._id": 1,
                                "user.name": 1,
                                "user.email": 1,
                                "user.mobile": 1,
                                "user.platformId": 1,
                                "user.isActive": 1,
                                "user.avatar": 1
                            }
                        },
                        { $sort: { [sortBy]: order === "asc" ? 1 : -1 } },
                        { $skip: skip },
                        { $limit: limit }
                    ],

                    totalCount: [
                        { $count: "count" }
                    ],

                    stats: [
                        {
                            $group: {
                                _id: null,
                                totalKycVerified: {
                                    $sum: {
                                        $cond: [{ $eq: ["$kycStatus", "verified"] }, 1, 0]
                                    }
                                },
                                totalBlocked: {
                                    $sum: {
                                        $cond: [{ $eq: ["$status", "blocked"] }, 1, 0]
                                    }
                                },
                                totalActive: {
                                    $sum: {
                                        $cond: [{ $eq: ["$status", "active"] }, 1, 0]
                                    }
                                },
                                totalSuspended: {
                                    $sum: {
                                        $cond: [{ $eq: ["$status", "suspended"] }, 1, 0]
                                    }
                                },
                                totalPendingKyc: {
                                    $sum: {
                                        $cond: [{ $eq: ["$kycStatus", "pending"] }, 1, 0]
                                    }
                                },
                                totalSubmitKyc: {
                                    $sum: {
                                        $cond: [{ $eq: ["$kycStatus", "submitted"] }, 1, 0]
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        ]);

        const riders = result[0].riders;
        const total = result[0].totalCount[0]?.count || 0;
        const stats = result[0].stats[0] || {
            totalKycVerified: 0,
            totalBlocked: 0,
            totalActive: 0,
            totalSuspended: 0,
            totalPendingKyc: 0,
            totalSubmitKyc: 0
        };

        const totalPages = Math.ceil(total / limit);

        res.status(200).json({
            success: true,
            total,
            totalPages,
            page,
            limit,
            stats,
            riders
        });

    } catch (err) {
        console.error("Get All Riders Error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


export const getRiderById = async (req, res) => {
    try {
        const { riderId } = req.params;

        const rider = await riderModal
            .findById(riderId).select("-__v").lean()

        if (!rider) {
            return res.status(404).json({
                success: false,
                message: "Rider not found"
            });
        }

        res.status(200).json({
            success: true,
            rider
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


export const updateRiderStatus = async (req, res) => {
    try {
        const { riderId } = req.params;
        const { status } = req.body;
        const allowedStatuses = ["active", "inactive"];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value"
            });
        }

        const user = await userModal.findById(riderId).select("isActive forceLogout name").lean();
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Rider not found"
            });
        }
        if (user) {
            if (["inactive"].includes(status)) {
                await userModal.findByIdAndUpdate(user._id, { isActive: false, forceLogout: true });
            } else if (status === "active") {
                await userModal.findByIdAndUpdate(user._id, { isActive: true, forceLogout: false });
            }
        }


        return res.status(200).json({
            success: true,
            message: `Rider status updated successfully to ${status}`,
            user
        });

    } catch (err) {
        console.error("Update Rider Status Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// step-1

export const riderVerification = async (req, res) => {
    try {

        const { name, email, mobile, otp } = req.body;

        if (!name || !email || !mobile || !otp) {
            return res.status(400).json({
                success: false,
                message: "All fields required"
            });
        }
        const sessionId = crypto.randomUUID();

        const otpRecord = await otpModal
            .findOne({ mobile: Number(mobile) })
            .sort({ createdAt: -1 });


        // if (!otpRecord || otpRecord.otp !== Number(otp) || otpRecord.expiresAt < Date.now()) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "Invalid OTP"
        //     });
        // }

        // await otpModal.deleteMany({ mobile });

        let user = await userModal.findOne({ mobile: Number(mobile) });
        const isNewUser = !user;
        let emailExists = null;
        if (email) {
            emailExists = await userModal.findOne({ email });
        }
        if (emailExists && emailExists.mobile !== Number(mobile)) {
            return res.status(400).json({
                success: false,
                message: "Email already in use with another account"
            });
        }

        if (!user) {
            user = await userModal.create({
                name,
                email,
                mobile: Number(mobile),
                role: "delivery_partner",
                isActive: false
            });
        } else {
            user.name = name;
            user.email = email;
            await user.save();
        }

        if (isNewUser) {
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

        // 🔥 SELLER CHECK
        let rider = await riderModal
            .findOne({ userId: user._id })
            .select("userId kycStep kycStatus currentLocation");

        if (!rider) {
            rider = await riderModal.create({
                userId: user._id,
                kycStep: 1,
                kycStatus: "pending",
                currentLocation: {
                    type: "Point",
                    coordinates: [0, 0]
                }
            });
        }

        // 🔥 KYC ALREADY SUBMITTED
        if (rider && rider.kycStatus === "submitted") {
            return res.status(200).json({
                success: true,
                message: "Your KYC is already submitted. Our team will contact you shortly.",
                token: generateToken(user, sessionId),
                user,
                step: 1
            });
        }

        if (rider?.kycStatus === "verified") {
            return res.json({
                success: true,
                message: "KYC already verified please check your email to get id password",
                step: 1
            });
        }


        let nextStep = 2;

        if (rider?.kycStep) {
            nextStep = rider.kycStep >= 5 ? 5 : rider.kycStep + 1;
        }
        const token = generateToken(user, sessionId);

        return res.status(200).json({
            success: true,
            message: isNewUser
                ? "Verification successful"
                : `Welcome back ${user?.name || "User"}, continue your onboarding`,
            token,
            user,
            step: Number(nextStep)
        });

    } catch (err) {
        console.log("Error in verification rider:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// step-2

export const saveRiderBasic = async (req, res) => {
    try {
        const { userId, city, vehicleType, vehicleNumber, drivingLicenseNumber } = req.body;
        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({ success: false, message: "invalid user id" });
        }

        if (!userId || !city || !vehicleType || !vehicleNumber || !drivingLicenseNumber) {
            return res.status(400).json({ success: false, message: "Basic info missing" });
        }

        let rider = await riderModal.findOne({ userId });

        if (!rider) {
            rider = await riderModal.create({
                userId,
                city,
                vehicleType,
                vehicleNumber,
                drivingLicenseNumber,
                kycStep: 2,
                kycStatus: "pending",
                currentLocation: {
                    type: "Point",
                    coordinates: [0, 0]
                },
            });
        } else {
            Object.assign(rider, {
                city,
                vehicleType,
                vehicleNumber,
                drivingLicenseNumber,
                kycStep: 2
            });
            await rider.save();
        }

        return res.status(201).json({ message: "success", success: true, rider });

    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: err.message });
    }
};

// step -3
export const saveRiderLocation = async (req, res) => {
    try {
        const { userId } = req.body;

        let geoLocation;

        if (typeof req.body.geoLocation === "string") {
            const parsed = JSON.parse(req.body.geoLocation);

            geoLocation = {
                type: "Point",
                coordinates: [Number(parsed.lng), Number(parsed.lat)]
            };
        } else {
            const parsed = req.body.geoLocation;

            geoLocation = {
                type: "Point",
                coordinates: [Number(parsed.lng), Number(parsed.lat)]
            };
        }

        const rider = await riderModal.findOneAndUpdate(
            { userId },
            {
                currentLocation: geoLocation,
                kycStep: 3
            },
            { new: true }
        );

        return res.json({ success: true, rider });

    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};


// step-4
export const saveRiderBank = async (req, res) => {
    try {
        const { userId } = req.body;

        const parsedBank =
            typeof req.body.bankDetails === "string"
                ? JSON.parse(req.body.bankDetails)
                : req.body.bankDetails;

        if (!parsedBank || !Object.keys(parsedBank).length) {
            return res.status(400).json({ message: "Bank details required" });
        }

        const rider = await riderModal.findOneAndUpdate(
            { userId },
            {
                bankDetails: parsedBank,
                kycStep: 4
            },
            { new: true }
        );

        return res.status(201).json({ success: true, rider });

    } catch (err) {
        // console.log(err)
        return res.status(500).json({ success: false, message: err.message });
    }
};

// step -5
export const saveRiderDocuments = async (req, res) => {
    try {
        const { userId } = req.body;

        const rider = await riderModal.findOne({ userId });

        if (!rider) {
            return res.status(404).json({ message: "Rider not found" });
        }

        if (
            !req.files?.rcDocument?.[0] ||
            !req.files?.licenseDocument?.[0] ||
            !req.files?.aadharDocument?.[0]
        ) {
            return res.status(400).json({ message: "All documents required" });
        }

        rider.rcDocument = req.files.rcDocument[0].path;
        rider.licenseDocument = req.files.licenseDocument[0].path;
        rider.aadharDocument = req.files.aadharDocument[0].path;

        rider.kycStep = 5;
        rider.kycStatus = "submitted";
        // return
        await rider.save();

        res.json({
            success: true,
            message: "KYC submitted successfully",
            rider
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// ye vala old hai jo khi pe bi use nhi aa rha...
export const submitRiderKyc = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await userModal
            .findOne({ _id: userId, role: "customer" })
            .select("name email mobile role").lean();

        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });

        if (user.role === "delivery_partner")
            return res.status(403).json({ success: false, message: "You are already in a delivery partner role" });

        const existingRider = await riderModal.findOne({ userId }).select("kycStatus").lean();

        if (existingRider?.kycStatus === "verified")
            return res.status(400).json({ message: "KYC already verified" });

        if (existingRider?.kycStatus === "pending")
            return res.status(400).json({ message: "KYC already submitted" });


        if (
            !req.files?.rcDocument?.[0] ||
            !req.files?.licenseDocument?.[0] ||
            !req.files?.aadharDocument?.[0]
        ) {
            return res.status(400).json({ message: "All documents required" });
        }


        const parsedBank =
            typeof req.body.bankDetails === "string"
                ? JSON.parse(req.body.bankDetails || "{}")
                : buildNestedObject(req.body, "bankDetails");

        let geoLocation;

        if (req.body.geoLocation) {
            const parsedGeo = JSON.parse(req.body.geoLocation);
            geoLocation = {
                type: "Point",
                coordinates: [Number(parsedGeo.lng), Number(parsedGeo.lat)]
            };
        } else {
            const geoCoords = req.body["geoLocation.coordinates"];
            if (!geoCoords || geoCoords.length !== 2)
                return res.status(400).json({ message: "Invalid geo location" });

            geoLocation = {
                type: "Point",
                coordinates: geoCoords.map(Number)
            };
        }

        /* ---------------- REQUIRED FIELDS ---------------- */

        const { city, vehicleType, vehicleNumber, drivingLicenseNumber } = req.body;

        if (!city || !vehicleType || !vehicleNumber || !drivingLicenseNumber)
            return res.status(400).json({ message: "Required fields missing" });

        /* ---------------- CREATE RIDER ---------------- */

        const rider = await riderModal.create({
            userId,
            city,
            vehicleType,
            vehicleNumber,
            drivingLicenseNumber,
            bankDetails: parsedBank,
            currentLocation: geoLocation,
            rcDocument: req.files.rcDocument[0].path,
            licenseDocument: req.files.licenseDocument[0].path,
            aadharDocument: req.files.aadharDocument[0].path,
            profileSnapshot: {
                name: user.name,
                mobile: user.mobile
            },
            kycStatus: "pending"
        });

        res.json({
            success: true,
            message: "KYC submitted successfully",
            rider
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};



export const riderKycAction = async (req, res) => {
    try {
        const { riderId } = req.params;
        const { action, rejectionReason } = req.body;

        if (!["verified", "rejected"].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Invalid action"
            });
        }

        if (action === "rejected" && !rejectionReason?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason required"
            });
        }

        const rider = await riderModal.findOneAndUpdate(
            {
                _id: riderId,
                kycStatus: "pending"
            },
            {
                $set: {
                    kycStatus: action,
                    isApproved: action === "verified",
                    status: action === "verified" ? "active" : "suspended",
                    rejectionReason: action === "rejected" ? rejectionReason : null,
                    kycVerifiedAt: action === "verified" ? new Date() : null,
                    kycRejectedAt: action === "rejected" ? new Date() : null
                }
            },
            { new: true }
        ).select("userId _id kycStatus isApproved status rejectionReason kycVerifiedAt kycRejectedAt").populate("userId", "_id name email").lean();

        if (!rider) {
            return res.status(400).json({
                success: false,
                message: "KYC already processed or rider not found"
            });
        }

        // ✅ Role update only on approval
        if (action === "verified") {
            await userModal.findByIdAndUpdate(
                rider.userId._id,
                { role: "delivery_partner" }
            );
            await walletSystemModal.updateOne(
                { ownerId: rider.userId._id, ownerType: "rider" },
                { $setOnInsert: { ownerId: rider.userId._id, ownerType: "rider" } },
                { upsert: true }
            );

        }
        // 📧 Send mail
        await sendSellerEmail({
            userName: rider.userId.name,
            userEmail: rider.userId.email,
            templateId:
                action === "verified"
                    ? "rider_kyc_approved"
                    : "rider_kyc_rejected",
            reason: rejectionReason
        });


        return res.status(200).json({
            success: true,
            message: `Rider KYC ${action} successfully`,
            rider
        });

    } catch (err) {
        console.error("RIDER KYC ACTION ERROR:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

