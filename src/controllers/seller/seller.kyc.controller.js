import sellerModal from "../../models/roleWiseModal/seller.modal.js";
import userModal from "../../models/roleWiseModal/user.modal.js";
import walletSystemModal from "../../models/walletSystem.modal.js";
import { sendSellerEmail } from "../../service/mailsend.js";
import crypto from "crypto";
import { generateToken } from "../auth/auth.controller.js";
import otpModal from "../../models/otp.modal.js";
import mongoose from "mongoose";


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

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

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



export const updateSellerProfile = async (req, res) => {
    try {
        const sellerId = req.user?.id;

        if (!mongoose.Types.ObjectId.isValid(sellerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid seller ID",
            });
        }

        const seller = await sellerModal.findOne({ userId: sellerId });
        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Seller not found",
            });
        }

        // ❌ block suspended/blocked
        if (["blocked", "suspended"].includes(seller.status)) {
            return res.status(403).json({
                success: false,
                message: `Seller is ${seller.status}`,
            });
        }

        const body = req.body;
        const files = req.files || {};

        // =========================
        // 🔥 VALIDATIONS
        // =========================

        if (body.GSTIN) {
            const gstRegex =
                /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (!gstRegex.test(body.GSTIN)) {
                return res.status(400).json({ success: false, message: "Invalid GST" });
            }
        }

        if (body.PAN) {
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
            if (!panRegex.test(body.PAN)) {
                return res.status(400).json({ success: false, message: "Invalid PAN" });
            }
        }

        if (body.aadhaarNumber) {
            if (!/^[0-9]{12}$/.test(body.aadhaarNumber)) {
                return res
                    .status(400)
                    .json({ success: false, message: "Invalid Aadhaar" });
            }
        }

        if (body.IFSC) {
            if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(body.IFSC)) {
                return res
                    .status(400)
                    .json({ success: false, message: "Invalid IFSC" });
            }
        }

        // =========================
        // 🔥 WORKING HOURS VALIDATION
        // =========================
        if (body.workingHours) {
            // Check if workingHours is an array
            if (!Array.isArray(body.workingHours)) {
                return res.status(400).json({
                    success: false,
                    message: "Working hours must be an array"
                });
            }

            const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

            // Validate each working hour entry
            for (const hour of body.workingHours) {
                // Check if day is valid
                if (!validDays.includes(hour.day)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid day: ${hour.day}. Must be one of ${validDays.join(', ')}`
                    });
                }

                // Validate time format if provided
                if (hour.open && !timeRegex.test(hour.open)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid open time format for ${hour.day}. Use HH:MM format`
                    });
                }

                if (hour.close && !timeRegex.test(hour.close)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid close time format for ${hour.day}. Use HH:MM format`
                    });
                }

                // Validate that open time is before close time if both provided
                if (hour.open && hour.close && hour.open >= hour.close) {
                    return res.status(400).json({
                        success: false,
                        message: `Open time must be before close time for ${hour.day}`
                    });
                }

                // Ensure isOpen field exists (default to true if not provided)
                if (hour.isOpen === undefined) {
                    hour.isOpen = true;
                }
            }

            // Optional: Check if all days are present
            const daysPresent = body.workingHours.map(h => h.day);
            const missingDays = validDays.filter(day => !daysPresent.includes(day));

            if (missingDays.length > 0 && missingDays.length !== validDays.length) {
                // You can either:
                // Option 1: Return error
                return res.status(400).json({
                    success: false,
                    message: `Missing working hours for: ${missingDays.join(', ')}. Please provide all days.`
                });

                // Option 2: Keep existing hours for missing days (uncomment below if you prefer this)
                // Keep existing working hours for missing days
            }
        }

        // =========================
        // 🔥 SAFE UPDATE OBJECT
        // =========================
        const updateData = {};

        // basic fields
        if (body.shopName) updateData.shopName = body.shopName;
        if (body.businessType) updateData.businessType = body.businessType;
        if (body.yearOfExperience) updateData.yearOfExperience = body.yearOfExperience;
        if (body.GSTIN) updateData.GSTIN = body.GSTIN;
        if (body.PAN) updateData.PAN = body.PAN;
        if (body.aadhaarNumber) updateData.aadhaarNumber = body.aadhaarNumber;

        // Shop status
        if (body.shopStatus) {
            const validStatuses = ['open', 'closed', 'temporarily_closed'];
            if (!validStatuses.includes(body.shopStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid shop status. Must be one of: ${validStatuses.join(', ')}`
                });
            }
            updateData.shopStatus = body.shopStatus;
        }

        // Delivery radius
        if (body.deliveryRadiusInKm) {
            const radius = parseInt(body.deliveryRadiusInKm);
            if (isNaN(radius) || radius < 0 || radius > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Delivery radius must be between 0 and 100 km"
                });
            }
            updateData.deliveryRadiusInKm = radius;
        }

        // =========================
        // 🔥 WORKING HOURS UPDATE
        // =========================
        if (body.workingHours && Array.isArray(body.workingHours)) {
            // If you want to replace all working hours
            updateData.workingHours = body.workingHours;

            // OR if you want to merge with existing working hours:
            /*
            const existingHours = seller.workingHours || [];
            const updatedHours = [...existingHours];
            
            body.workingHours.forEach(newHour => {
                const index = updatedHours.findIndex(h => h.day === newHour.day);
                if (index !== -1) {
                    updatedHours[index] = { ...updatedHours[index], ...newHour };
                } else {
                    updatedHours.push(newHour);
                }
            });
            
            updateData.workingHours = updatedHours;
            */
        }

        // pickup address (nested safe merge)
        if (body.street || body.city || body.state || body.pincode || body.country) {
            updateData.pickupDelivery = {
                ...(seller.pickupDelivery ? seller.pickupDelivery.toObject() : {}),
                ...(body.street && { street: body.street }),
                ...(body.city && { city: body.city }),
                ...(body.state && { state: body.state }),
                ...(body.pincode && { pincode: body.pincode }),
                ...(body.country && { country: body.country }),
            };
        }

        // bank details
        if (
            body.accountHolderName ||
            body.accountNumber ||
            body.IFSC ||
            body.bankName ||
            body.UPI
        ) {
            updateData.bankDetails = {
                ...seller.bankDetails,
                ...(body.accountHolderName && {
                    accountHolderName: body.accountHolderName,
                }),
                ...(body.accountNumber && {
                    accountNumber: body.accountNumber,
                }),
                ...(body.IFSC && { IFSC: body.IFSC }),
                ...(body.bankName && { bankName: body.bankName }),
                ...(body.UPI && { UPI: body.UPI }),
            };
        }

        // social
        if (body.whatsapp || body.instagram || body.facebook || body.twitter || body.linkedin || body.websiteLink || body.emailId) {
            updateData.socialAccount = {
                ...seller.socialAccount,
                ...(body.whatsapp && { whatsapp: body.whatsapp }),
                ...(body.instagram && { instagram: body.instagram }),
                ...(body.facebook && { facebook: body.facebook }),
                ...(body.twitter && { twitter: body.twitter }),
                ...(body.linkedin && { linkedin: body.linkedin }),
                ...(body.websiteLink && { websiteLink: body.websiteLink }),
                ...(body.emailId && { emailId: body.emailId }),
            };
        }

        // =========================
        // 🔥 FILE UPLOAD HANDLING
        // =========================
        if (files.aadhaarFront) {
            updateData["kycDocuments.aadhaarFront"] =
                files.aadhaarFront[0].path;
        }

        if (files.aadhaarBack) {
            updateData["kycDocuments.aadhaarBack"] =
                files.aadhaarBack[0].path;
        }

        if (files.panCard) {
            updateData["kycDocuments.panCard"] = files.panCard[0].path;
        }

        if (files.gstCertificate) {
            updateData["kycDocuments.gstCertificate"] =
                files.gstCertificate[0].path;
        }

        if (files.shopLicense) {
            updateData["kycDocuments.shopLicense"] =
                files.shopLicense[0].path;
        }

        if (files.cancelledCheque) {
            updateData["kycDocuments.cancelledCheque"] =
                files.cancelledCheque[0].path;
        }

        // Check if there's anything to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields to update"
            });
        }

        // =========================
        // 🚀 UPDATE (ONLY CHANGED)
        // =========================
        console.log("Update Data:", updateData);

        const updatedSeller = await sellerModal.findByIdAndUpdate(
            seller._id, // Use seller._id instead of sellerId
            { $set: updateData },
            { new: true, runValidators: true }
        );

        return res.json({
            success: true,
            message: "Seller updated successfully",
            seller: updatedSeller,
        });
    } catch (error) {
        console.error("UPDATE SELLER ERROR:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error",
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

