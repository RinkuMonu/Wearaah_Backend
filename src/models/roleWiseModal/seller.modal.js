import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        shopName: {
            type: String,
            trim: true
        },

        businessType: {
            type: String,
            enum: ["individual", "proprietorship", "partnership", "pvt_ltd"],
        },
        yearOfExperience: {
            type: String,
            enum: ["0-1", "1-3", "3-5", "5+"],
        },

        termsAndConditions: {
            accepted: { type: Boolean, default: false },
            acceptedAt: Date,
            ipAddress: String
        },

        GSTIN: {
            type: String,
            trim: true,
            match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format"],
            // message: "Invalid GSTIN format",
            // required: function () {
            //     return this.businessType !== "individual";
            // }
        },

        PAN: {
            type: String,
            trim: true,
            uppercase: true,
            match: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
            message: "Invalid PAN format"
        },
        aadhaarNumber: {
            type: String,
            match: /^[0-9]{12}$/
        },

        pickupDelivery: {
            street: String,
            city: String,
            state: String,
            pincode: String,
            country: { type: String, default: "India" }
        },

        geoLocation: {
            type: {
                type: String,
                enum: ["Point"],
                // default: "Point"
            },
            coordinates: {
                type: [Number],
                validate: {
                    validator: v => v.length === 2,
                    message: "Coordinates must be [lng, lat]"
                }
            }
        },

        shopStatus: {
            type: String,
            enum: ["open", "closed", "holiday"],
            default: "open"
        },

        workingHours: [
            {
                day: String,
                open: String,
                close: String,
                isClosed: Boolean
            }
        ],
        kycStep: {
            type: Number
        },
        isTrustedSeller: {
            type: Boolean,
            default: false
        },

        performance: {
            lateShipmentRate: Number,
            onTimeDeliveryRate: Number,
            customerSatisfaction: Number
        },

        returnPolicyDays: {
            type: Number,
            default: 7
        },

        deliveryRadiusInKm: {
            type: Number,
            default: 5
        },

        bankDetails: {
            accountHolderName: String,
            accountNumber: String,
            IFSC: String,
            bankName: String,
            UPI: String
        },

        commissionRate: {
            type: Number,
            default: 10
            // 🔥 Platform commission percentage (super admin sets this)
        },

        settlementCycleDays: {
            type: Number,
            default: 7
            //Payment release cycle (7 days after delivery)
        },

        kycDocuments: {
            aadhaarFront: {
                type: String,
            },
            aadhaarBack: {
                type: String,
            },

            gstCertificate: {
                type: String,
                required: function () {
                    return this.businessType !== "individual";
                }
            },

            panCard: {
                type: String,
            },

            shopLicense: {
                type: String,
            },

            cancelledCheque: {
                type: String,
            }
        },
        socialAccount: {
            whatsapp: String,
            instagram: String,
            facebook: String,
            twitter: String,
            linkedin: String,
            websiteLink: String,
            emailId: String
        },

        kycStatus: {
            type: String,
            enum: ["pending", "submitted", "verified", "rejected"],
            default: "pending"
        },

        rejectionReason: {
            type: String,
            default: ""
        },
        invoicePrefix: {
            type: String,//shop name code UFG
            uppercase: true
        },
        isApproved: {
            type: Boolean,
            default: false
        },

        totalProducts: {
            type: Number,
            default: 0
        },

        totalOrders: {
            type: Number,
            default: 0
        },

        totalRevenue: {
            type: Number,
            default: 0
        },

        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },

        cancellationRate: {
            type: Number,
            default: 0
        },

        status: {
            type: String,
            enum: ["active", "suspended", "blocked", "inprogress"],
            default: "inprogress"
        },

        isOnline: {
            type: Boolean,
            default: false
        },
        kycVerifiedAt: Date,
        kycRejectedAt: Date,

    },
    { timestamps: true }
);

sellerSchema.index({ geoLocation: "2dsphere" });
sellerSchema.index({ userId: 1, kycStatus: 1, shopStatus: 1, isApproved: 1, status: 1, isOnline: 1, averageRating: 1, cancellationRate: 1, totalRevenue: 1, totalOrders: 1, totalProducts: 1, createdAt: 1, updatedAt: 1 });

export default mongoose.model("Seller", sellerSchema);
