import sellerModal from "../../models/roleWiseModal/seller.modal.js";
import userModal from "../../models/roleWiseModal/user.modal.js";
import walletSystemModal from "../../models/walletSystem.modal.js";
import { sendSellerEmail } from "../../service/mailsend.js";
import crypto from "crypto";
import { generateToken } from "../auth/auth.controller.js";
import otpModal from "../../models/otp.modal.js";


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
            kycStatus,
            kycStep,
            isApproved,
            sortBy = "createdAt",
            order = "desc"
        } = req.query;

        const skip = (page - 1) * limit;

        /* 🔎 USER SEARCH */
        let userIds = [];
        const isNumber = !isNaN(search);

        if (search) {
            const users = await userModal.find({
                $or: [
                    { name: new RegExp(search, "i") },
                    { email: new RegExp(search, "i") },
                    ...(isNumber ? [{ mobile: Number(search) }] : [])
                ]
            }).select("_id").lean();

            userIds = users.map(u => u._id);
        }

        /* 🔎 FILTER */
        const filter = {};

        if (city) filter["pickupDelivery.city"] = city;
        if (kycStatus) filter.kycStatus = kycStatus;
        if (kycStep) filter.kycStep = Number(kycStep);
        if (isApproved === "true") {
            filter.isApproved = true;
        } else if (isApproved === "false") {
            filter.isApproved = false;
        }
        // if (search) {
        //     filter.$or = [
        //         { shopName: new RegExp(search, "i") },
        //         // ...(userIds.length ? [{ userId: { $in: userIds } }] : [])
        //     ];
        // }

        const sellers = await sellerModal
            .find(filter)
            .select(
                "shopName kycStatus kycStep isApproved createdAt kycDocuments userId"
            )
            .populate("userId", "name mobile") // only required
            .sort({ [sortBy]: order === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        /* 🔥 ADD DOCUMENT COUNT ONLY */
        const formatted = sellers.map(s => ({
            _id: s._id,
            shopName: s.shopName,
            ownerName: s.userId?.name,
            mobile: s.userId?.mobile,
            kycStatus: s.kycStatus,
            kycStep: s.kycStep,
            isApproved: s.isApproved,
            createdAt: s.createdAt,
            //   documentCount: Object.values(s.kycDocuments || {}).filter(Boolean).length
        }));

        const total = await sellerModal.countDocuments(filter);

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            sellers: formatted
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
        const seller = await sellerModal
            .findById(req.params.sellerId)
            .populate("userId", "name email mobile role")
            .lean();

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
            !req.files?.shopLicense?.[0] ||
            !req.files?.aadhaarFront?.[0] ||
            !req.files?.aadhaarBack?.[0]
        ) {
            return res.status(400).json({
                success: false,
                message: "PAN, shopLicense, aadhar (back/front) & cancelled cheque required"
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
            aadhaarFront: req.files?.aadhaarFront?.[0]?.path || null,
            aadhaarBack: req.files?.aadhaarBack?.[0]?.path || null,
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

// step -1
export const verification = async (req, res) => {
    try {
        const { name, email, mobile, otp } = req.body;

        if (!name || !email || !mobile || !otp) {
            return res.status(400).json({
                success: false,
                message: "All fields required"
            });
        }

        const sessionId = crypto.randomUUID();

        // 🔥 OTP CHECK FIRST
        // const otpRecord = await otpModal.findOne({ mobile, otp });

        // if (!otpRecord || otpRecord.expiresAt < Date.now()) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "Invalid or expired OTP"
        //     });
        // }

        // await otpModal.deleteMany({ mobile });

        // 🔥 FIND USER FIRST
        const existingUser = await userModal.findOne({
            $or: [{ email }, { mobile }]
        });

        let user = existingUser;

        // 🔥 CREATE IF NEW
        if (!user) {
            user = await userModal.create({
                name,
                email,
                mobile: Number(mobile),
                role: "customer"
            });
        }

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

        // 🔥 SELLER CHECK
        const seller = await sellerModal
            .findOne({ userId: user._id })
            .select("kycStep kycStatus");

        // 🔥 KYC ALREADY SUBMITTED
        if (seller && seller.kycStatus === "submitted") {
            return res.status(200).json({
                success: true,
                message: "Your KYC is already submitted. Our team will contact you shortly.",
                token: generateToken(user, sessionId),
                user,
                step: 5
            });
        }

        let nextStep = 1;

        if (seller) {
            nextStep = seller.kycStep || 1;
            nextStep = nextStep >= 5 ? 5 : nextStep + 1;
        }

        const token = generateToken(user, sessionId);

        return res.status(200).json({
            success: true,
            message: existingUser
                ? `Welcome back ${user.name || "User"}, continue your onboarding`
                : "Verification successful",
            token,
            user,
            step: Number(nextStep)
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// step -2
export const saveBasicInfo = async (req, res) => {
    try {
        const userId = req.user.id || req.body.userId;
        const { shopName, businessType, yearOfExperience, PAN, GSTIN } = req.body;

        if (!shopName || !businessType || !PAN ||
            (businessType !== "individual" && !GSTIN)
        ) {
            return res.status(400).json({ success: false, message: "Basic info missing" });
        }

        let seller = await sellerModal.findOne({ userId })

        if (!seller) {
            seller = await sellerModal.create({
                userId,
                shopName,
                businessType,
                yearOfExperience,
                PAN,
                GSTIN,
                kycStep: 2,
                kycStatus: "pending"
            });
        } else {
            Object.assign(seller, {
                shopName,
                businessType,
                yearOfExperience,
                PAN,
                GSTIN,
                kycStep: 2
            });
            await seller.save();
        }

        res.json({ success: true, seller });

    } catch (err) {
        console.log("step 2", err)
        res.status(500).json({ success: false, message: err.message });
    }
};




// step -3
export const saveAddress = async (req, res) => {
    try {
        const userId = req.user.id || req.body.userId;
        console.log(req.body)

        // const parsedPickup = typeof req.body.pickupDelivery === "string"
        //     ? JSON.parse(req.body.pickupDelivery || "{}")
        //     : buildNestedObject(req.body, "pickupDelivery");
        const parsedPickup =
            typeof req.body.pickupDelivery === "string"
                ? JSON.parse(req.body.pickupDelivery)
                : req.body.pickupDelivery;
        const geoCoords = req.body["geoLocation.coordinates"];

        // const parsedGeo =
        //     Array.isArray(geoCoords) && geoCoords.length === 2
        //         ? { type: "Point", coordinates: geoCoords.map(Number) }
        //         : null;

        const parsedGeo =
            req.body.geoLocation?.coordinates?.length === 2
                ? {
                    type: "Point",
                    coordinates: req.body.geoLocation.coordinates.map(Number)
                }
                : null;

        if (!Object.keys(parsedPickup).length)
            return res.status(400).json({ success: false, message: "Pickup address required" });

        if (!parsedGeo)
            return res.status(400).json({ success: false, message: "Location required" });

        const seller = await sellerModal.findOneAndUpdate(
            { userId },
            {
                pickupDelivery: parsedPickup,
                geoLocation: parsedGeo,
                kycStep: 3
            },
            { new: true }
        )

        res.json({ success: true, seller });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};



// step -4
export const saveBankDetails = async (req, res) => {
    try {
        const userId = req.user.id || req.body.userId;

        const parsedBank =
            typeof req.body.bankDetails === "string"
                ? JSON.parse(req.body.bankDetails)
                : req.body.bankDetails;

        if (!Object.keys(parsedBank).length)
            return res.status(400).json({ success: false, message: "Bank details required" });

        const seller = await sellerModal.findOneAndUpdate(
            { userId },
            {
                bankDetails: parsedBank,
                kycStep: 4
            },
            { new: true }
        )

        res.json({ success: true, seller });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


// step -5
const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
];

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const validateFile = (file, fieldName) => {
    if (!file) {
        throw new Error(`${fieldName} is required`);
    }

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
        throw new Error(`${fieldName} must be image or PDF`);
    }

    if (file.size > MAX_SIZE) {
        throw new Error(`${fieldName} must be less than 2MB`);
    }
};

export const saveDocuments = async (req, res) => {
    try {
        const userId = req.user.id || req.body.userId;

        const seller = await sellerModal.findOne({ userId });

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller not found"
            });
        }

        const files = req.files || {};

        // 🔥 VALIDATION
        validateFile(files?.panCard?.[0], "PAN Card");
        validateFile(files?.aadhaarFront?.[0], "Aadhaar Front");
        validateFile(files?.aadhaarBack?.[0], "Aadhaar Back");
        validateFile(files?.shopLicense?.[0], "Shop License");
        validateFile(files?.cancelledCheque?.[0], "Cancelled Cheque");

        if (seller.businessType !== "individual") {
            validateFile(files?.gstCertificate?.[0], "GST Certificate");
        }
        const formatPath = (file) => {
            if (!file?.path) return null;

            // ensure always starts with /
            return file.path.startsWith("/") ? file.path : `/${file.path}`;
        };
        // 🔥 SAVE PATHS
        seller.kycDocuments = {
            panCard: formatPath(files.panCard?.[0]),
            aadhaarFront: formatPath(files.aadhaarFront?.[0]),
            aadhaarBack: formatPath(files.aadhaarBack?.[0]),
            shopLicense: formatPath(files.shopLicense?.[0]),
            cancelledCheque: formatPath(files.cancelledCheque?.[0]),
            gstCertificate: formatPath(files.gstCertificate?.[0])
        };

        // 🔥 TERMS CHECK (merge step 6 here)
        if (req.body.termsAccepted !== "true") {
            return res.status(400).json({
                success: false,
                message: "Please accept terms & conditions"
            });
        }

        seller.termsAndConditions = {
            accepted: true,
            acceptedAt: new Date(),
            ipAddress: req.ip
        };

        seller.kycStep = 5;
        seller.kycStatus = "submitted";

        await seller.save();

        return res.json({
            success: true,
            message: "Documents uploaded & KYC submitted",
            seller
        });

    } catch (err) {
        return res.status(400).json({
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

