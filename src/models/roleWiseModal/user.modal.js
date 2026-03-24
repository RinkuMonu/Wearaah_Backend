import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import counterModel from "../counter.model.js";

const userSchema = new mongoose.Schema(
    {
        platformId: {
            type: String,
            unique: true,
            index: true
        },

        name: {
            type: String,
            // required: true,
            trim: true
        },

        email: {
            type: String,
            lowercase: true,
            sparse: true
        },

        mobile: {
            type: Number,
            required: true,
            unique: true,
            match: /^[6-9]\d{9}$/
        },

        password: {
            type: String,
            // required: true,
            select: false
        },

        avatar: {
            type: String,
            default: "https://www.clipartmax.com/png/full/144-1442578_flat-person-icon-download-dummy-man.png"
        },

        role: {
            type: String,
            enum: ["superadmin", "customer", "seller", "delivery_partner"],
            default: "customer",
        },

        isVerified: {
            type: Boolean,
            default: false // email / mobile verified
        },

        isActive: {
            type: Boolean,
            default: true
        },

        isBlocked: {
            type: Boolean,
            default: false
        },

        forceLogout: {
            type: Boolean,
            default: false
        },
        blockReason: {
            type: String,
            required: function () {
                return this.isBlocked === true
            }
        },
        sessionId: String,
        lastLogin: Date,
    },
    { timestamps: true }
);
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isBlocked: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ name: "text", email: "text" });

// userSchema.pre("save", async function (next) {
//     if (!this.isModified("password")) return next();

//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
// });

userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre("validate", async function (next) {
    if (!this.platformId) {
        let prefix = "C";

        if (this.role === "seller") prefix = "S";
        if (this.role === "delivery_partner") prefix = "R";
        if (this.role === "superadmin") prefix = "A";

        const counter = await counterModel.findOneAndUpdate(
            { name: `user_${this.role}` },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        const paddedSeq = counter.seq.toString().padStart(6, "0");

        this.platformId = `WR-${prefix}-${paddedSeq}`;
    }

    next();
});

export default mongoose.model("User", userSchema);
