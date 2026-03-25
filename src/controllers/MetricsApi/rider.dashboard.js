import orderModal from "../../models/order.modal.js";
import riderModal from "../../models/roleWiseModal/rider.modal.js";

export const getRiderDashBoard = async (req, res) => {
    try {

        const rider = await riderModal.findOne({ userId: req.user.id });

        if (!rider) {
            return res.status(404).json({ message: "Rider not found" });
        }

        const riderId = rider._id;

        const [
            totalDeliveries,
            completedDeliveries,
            pendingDeliveries,
            earnings,
            wallet
        ] = await Promise.all([
            orderModal.countDocuments({ riderId }),
            orderModal.countDocuments({ riderId, orderStatus: "delivered" }),
            orderModal.countDocuments({ riderId, orderStatus: { $in: ["confirmed", "packed", "shipped"] } }),
            orderModal.aggregate([{ $match: { riderId, paymentStatus: "paid" } },
            { $group: { _id: null, total: { $sum: "$riderAmount" } } }
            ]),
            walletModal.findOne({ ownerId: req.user.id })
        ]);

        res.json({
            success: true,
            data: {
                totalDeliveries,
                completedDeliveries,
                pendingDeliveries,
                totalEarnings: earnings[0]?.total || 0,
                walletBalance: wallet?.availableBalance || 0,
                lockedBalance: wallet?.lockedBalance || 0
            }
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
