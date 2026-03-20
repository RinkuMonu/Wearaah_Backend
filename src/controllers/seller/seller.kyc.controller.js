import sellerModal from "../../models/roleWiseModal/seller.modal.js";
import userModal from "../../models/roleWiseModal/user.modal.js";
import walletSystemModal from "../../models/walletSystem.modal.js";
import { sendSellerEmail } from "../../service/mailsend.js";


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



export const getAllSellers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            city,
            status,
            kycStatus,
            isApproved,
            sortBy = "createdAt",
            order = "desc"
        } = req.query;

        const skip = (page - 1) * limit;

        /* 🔎 USER SEARCH */
        let userFilter = {};

        if (search) {
            const users = await userModal.find({
                $or: [
                    { name: new RegExp(search, "i") },
                    { email: new RegExp(search, "i") },
                    { mobile: new RegExp(search, "i") }
                ]
            }).select("_id").lean();;

            userFilter.userId = { $in: users.map(u => u._id) };
        }

        /* 🔎 SELLER FILTER */
        const filter = {
            ...userFilter
        };

        if (city) filter["pickupDelivery.city"] = city;
        if (status) filter.status = status;
        if (kycStatus) filter.kycStatus = kycStatus;
        if (isApproved !== undefined) filter.isApproved = isApproved;

        /* 🔎 GLOBAL SEARCH IN SELLER FIELDS */
        if (search) {
            filter.$or = [
                { shopName: new RegExp(search, "i") },
                { GSTIN: new RegExp(search, "i") },
                { PAN: new RegExp(search, "i") }
            ];
        }

        const sellers = await sellerModal
            .find(filter)
            .populate("userId", "name email mobile")
            .sort({ [sortBy]: order === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(Number(limit)).lean();;

        const total = await sellerModal.countDocuments(filter).lean();

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            sellers
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


export const getSellerById = async (req, res) => {
    try {
        const { sellerId } = req.params;

        const seller = await sellerModal
            .findById(sellerId)
            .populate("userId", "name email mobile isActive isBlocked").lean();

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller not found"
            });
        }

        res.status(200).json({
            success: true,
            seller
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


export const submitSellerKyc = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const {
            shopName,
            businessType,
            yearOfExperience,
            PAN,
            GSTIN,
            workingHours,
            termsAccepted
        } = req.body;


        const parsedPickup =
            typeof req.body.pickupDelivery === "string"
                ? JSON.parse(req.body.pickupDelivery || "{}")
                : buildNestedObject(req.body, "pickupDelivery");

        const parsedBank =
            typeof req.body.bankDetails === "string"
                ? JSON.parse(req.body.bankDetails || "{}")
                : buildNestedObject(req.body, "bankDetails");

        const parsedSocial =
            typeof req.body.socialAccount === "string"
                ? JSON.parse(req.body.socialAccount || "{}")
                : buildNestedObject(req.body, "socialAccount");

        const geoCoords = req.body["geoLocation.coordinates"];

        const parsedGeo =
            Array.isArray(geoCoords) && geoCoords.length === 2
                ? {
                    type: "Point",
                    coordinates: geoCoords.map(Number)
                }
                : null;

        const workingHoursParsed =
            typeof workingHours === "string"
                ? JSON.parse(workingHours)
                : workingHours;


        if (!shopName || !businessType || !PAN ||
            (businessType !== "individual" && !GSTIN)
        ) {
            return res.status(400).json({
                success: false,
                message: "Required fields missing"
            });
        }

        if (!Object.keys(parsedPickup).length)
            return res.status(400).json({ success: false, message: "Pickup address required" });

        if (!Object.keys(parsedBank).length)
            return res.status(400).json({ success: false, message: "Bank details required" });

        if (!parsedGeo)
            return res.status(400).json({ success: false, message: "Please enable location" });

        if (termsAccepted !== "true")
            return res.status(400).json({ success: false, message: "Accept terms & conditions" });

        /* ---------------- FILE VALIDATION ---------------- */

        if (
            !req.files?.panCard?.[0] ||
            !req.files?.cancelledCheque?.[0] ||
            !req.files?.shopLicense?.[0]
        ) {
            return res.status(400).json({
                success: false,
                message: "PAN, shopLicense & cancelled cheque required"
            });
        }

        if (businessType !== "individual" && !req.files?.gstCertificate?.[0]) {
            return res.status(400).json({
                success: false,
                message: "GST certificate required for non-individual"
            });
        }

        /* ---------------- USER CHECK ---------------- */

        const user = await userModal
            .findById(userId)
            .select("name email mobile role");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        /* ---------------- SELLER CHECK ---------------- */

        let seller = await sellerModal.findOne({ userId });

        if (seller?.kycStatus === "verified") {
            return res.status(400).json({
                success: false,
                message: "KYC already verified"
            });
        }

        if (seller?.kycStatus === "pending") {
            return res.status(400).json({
                success: false,
                message: "KYC already submitted"
            });
        }

        /* ---------------- DOCUMENTS ---------------- */

        const documents = {
            gstCertificate: req.files?.gstCertificate?.[0]?.path || null,
            panCard: req.files?.panCard?.[0]?.path || null,
            shopLicense: req.files?.shopLicense?.[0]?.path || null,
            cancelledCheque: req.files?.cancelledCheque?.[0]?.path || null
        };

        /* ---------------- FINAL DATA ---------------- */

        const sellerData = {
            userId,
            shopName,
            businessType,
            yearOfExperience,
            PAN,
            GSTIN,
            pickupDelivery: parsedPickup,
            geoLocation: parsedGeo,
            bankDetails: parsedBank,
            workingHours: workingHoursParsed,
            socialAccount: Object.keys(parsedSocial).length ? parsedSocial : undefined,
            termsAndConditions: {
                accepted: true,
                acceptedAt: new Date(),
                ipAddress: req.ip
            },
            kycDocuments: documents,
            kycStatus: "pending",
            isApproved: false,
            status: "active"
        };

        if (!seller) {
            seller = await sellerModal.create(sellerData);
        } else {
            Object.assign(seller, sellerData);
            await seller.save();
        }

        return res.status(200).json({
            success: true,
            message: "KYC submitted successfully",
            seller
        });

    } catch (err) {
        console.error("SELLER KYC ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};




export const sellerKycAction = async (req, res) => {
    try {
        const { sellerId } = req.params;
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

        // 🎯 Atomic condition
        const seller = await sellerModal.findOneAndUpdate(
            {
                _id: sellerId,
                kycStatus: "pending"
            },
            {
                $set: {
                    kycStatus: action,
                    isApproved: action === "verified",
                    status: action === "verified" ? "active" : "suspended",
                    kycVerifiedAt: action === "verified" ? new Date() : null,
                    kycRejectedAt: action === "rejected" ? new Date() : null,
                    rejectionReason: action === "rejected" ? rejectionReason : null
                }
            },
            {
                new: true
            }
        ).select("userId _id kycStatus isApproved status rejectionReason kycVerifiedAt kycRejectedAt").populate("userId", "_id name email").lean();

        if (!seller) {
            return res.status(400).json({
                success: false,
                message: "KYC already processed or seller not found"
            });
        }
        if (action === "verified") {
            await userModal.findByIdAndUpdate(
                seller.userId._id,
                { role: "seller" }
            );
            await walletSystemModal.updateOne(
                { ownerId: seller.userId._id, ownerType: "seller" },
                { $setOnInsert: { ownerId: seller.userId._id, ownerType: "seller" } },
                { upsert: true }
            );


        }
        await sendSellerEmail({
            userName: seller.userId.name,
            userEmail: seller.userId.email,
            templateId:
                action === "verified"
                    ? "seller_kyc_approved"
                    : "seller_kyc_rejected",
            reason: rejectionReason
        });



        return res.status(200).json({
            success: true,
            message: `Seller ${action} successfully`,
            seller
        });

    } catch (err) {
        console.error("Error in sellerKycAction:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

