import axios from "axios";
import otpModal from "../models/otp.modal.js";

const sendOtpService = async (mobile, otp) => {
    try {
        const authKey = process.env.MSG91_AUTH_KEY;
        const templatedForRegisteer = process.env.MSG91_TEMPLATE_ID_N_REG;
        if (!authKey) {
            console.error("Missing MSG91 Auth Key or Template ID");
            throw new Error("MSG91 Auth Key or Template ID is missing");
        }

        const payload = {
            template_id: templatedForRegisteer,
            recipients: [
                {
                    mobiles: "91" + mobile,
                    OTP: otp,
                    name: "User",
                },
            ],
        };

        const response = await axios.post(
            "https://control.msg91.com/api/v5/flow",
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    authkey: authKey,
                },
            }

        );
        // console.log(response)
        if (response.data.type === "success") {
            return { success: true, message: "OTP sent successfully" };
        } else {
            const errorMessage = response.data.message || "Failed to send OTP";
            return { success: false, message: errorMessage };
        }
    } catch (error) {
        if (error.response) {
            console.error("Error in sendOtp - Response Error:", error.response.data);
            return {
                success: false,
                message: error.response.data.message || "Failed to send OTP",
            };
        } else {
            console.error("Error in sendOtp - General Error:", error.message);
            return { success: false, message: "Error sending OTP" };
        }
    }
};

export const sendOtpController = async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({ success: false, message: "mobile number is missing" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await otpModal.findOneAndUpdate(
            { mobile },
            {
                otp,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000)
            },
            { upsert: true }
        );
        // const smsResult = await sendOtpService(mobile, otp);
        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            data: { mobile },
        });
        // if (smsResult.success) {
        //     return res.status(200).json({
        //         success: true,
        //         message: "OTP sent successfully",
        //         data: { mobile },
        //     });
        // } else {
        //     return res.status(400).json({
        //         success: false,
        //         message: smsResult.message || "Failed to send OTP",
        //     });
        // }
    } catch (error) {
        console.log(error)
        return res.status(400).json({
            success: false,
            message: "Unable to send otp",
        });

    }
};

