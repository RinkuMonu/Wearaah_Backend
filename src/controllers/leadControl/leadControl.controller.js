import SRleadModal from "../../models/leadModal/SRlead.modal.js";
import userModal from "../../models/roleWiseModal/user.modal.js";

export const createLead = async (req, res) => {
    try {
        const { leadType, name, mobile, email, shopName, city, businessType, leadSource } = req.body;

        if (!email || !name || !mobile || !city) {
            return res.status(400).json({
                success: false,
                message: "Please fill name, email, mobile and city"
            });
        }
        if (!leadType || !leadSource) {
            return res.status(400).json({
                success: false,
                message: "Hii... Devloper leadType or leadSource is missing please check..."
            });
        }
        if (leadType === "be_seller") {
            if (!businessType || !shopName) {
                return res.status(400).json({
                    success: false,
                    message: "please select your Business type & shopName"
                })
            }
        }

        const existingLead = await SRleadModal.findOne({ mobile, leadType }).select("mobile leadType").lean();

        if (existingLead) {
            return res.status(400).json({
                success: false,
                message: "Hello, your request has already been sent. Please wait— our team will contact you shortly"
            });
        }

        const lead = await SRleadModal.create({
            leadType,
            name,
            mobile,
            email,
            shopName,
            city,
            businessType,
            leadSource
        });

        return res.status(201).json({
            success: true,
            message: "your request has been submitted successfully. Please wait while our team contacts you shortly",
            lead
        });

    } catch (err) {
        console.error("CREATE LEAD ERROR:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};










export const getAllLeads = async (req, res) => {
    try {

        const {
            page = 1,
            limit = 10,
            search,
            leadType,
            status,
            businessType,
            leadSource,
            city
        } = req.query;

        const filter = {};

        // filters
        if (leadType) filter.leadType = leadType;
        if (status) filter.status = status;
        if (businessType) filter.businessType = businessType;
        if (leadSource) filter.leadSource = leadSource;
        if (city) filter.city = new RegExp(city, "i");

        // search (name, mobile, email)
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { mobile: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const leads = await SRleadModal.find(filter)
            // .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        const total = await SRleadModal.countDocuments(filter);

        return res.json({
            success: true,
            total,
            page: Number(page),
            limit: Number(limit),
            leads
        });

    } catch (err) {
        console.error("GET LEADS ERROR:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};




export const getLeadsByType = async (req, res) => {
    try {

        const { type } = req.params;

        const leads = await SRleadModal.find({ leadType: type })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            leads
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};




export const updateLeadStatus = async (req, res) => {
    try {

        const { leadId } = req.params;
        const { status, notes } = req.body;

        const allowedStatus = ["new", "contacted", "converted", "rejected"];

        if (!allowedStatus.includes(status) || !notes) {
            return res.status(400).json({
                success: false,
                message: "Invalid status or notes missing"
            });
        }

        // block update if already converted or rejected
        const lead = await SRleadModal.findOneAndUpdate(
            {
                _id: leadId,
                status: { $nin: ["converted", "rejected"] }
            },
            {
                $set: { status, notes }
            },
            {
                new: true
            }
        )
            .select("name mobile email leadType status")
            .lean();

        if (!lead) {
            return res.status(400).json({
                success: false,
                message: "Lead already finalized"
            });
        }

        if (status === "converted") {

            try {

                await userModal.create({
                    name: lead.name,
                    mobile: lead.mobile,
                    email: lead.email,
                    role: lead.leadType === "be_seller" ? "seller" : "delivery_partner",
                    password: "wearaah@1234"
                });

            } catch (err) {

                if (err.code === 11000) {

                    const existingUser = await userModal
                        .findOne({ mobile: lead.mobile })
                        .select("role")
                        .lean();

                    return res.status(400).json({
                        success: false,
                        message: `This user already a ${existingUser?.role}`
                    });

                }

                throw err;
            }
        }

        return res.json({
            success: true,
            message: "Lead status updated",
            lead
        });

    } catch (err) {

        console.error("UPDATE LEAD STATUS ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};




export const deleteLead = async (req, res) => {
    try {

        const { leadId } = req.params;

        const lead = await SRleadModal.findByIdAndDelete(leadId);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            });
        }

        res.json({
            success: true,
            message: "Lead deleted"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};






