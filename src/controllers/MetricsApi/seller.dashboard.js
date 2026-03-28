import sellerModal from "../../models/roleWiseModal/seller.modal.js";
import productModel from "../../models/product.model.js";
import orderModal from "../../models/order.modal.js";
import walletSystemModal from "../../models/walletSystem.modal.js";

export const getSellerDashboard = async (req, res) => {
    try {

        // const seller = await sellerModal.findOne({ userId: req.user.id || req.user._id, kycStatus: "approved" }).select("_id kycStatus");
        // if (!seller) {
        //     return res.status(404).json({ message: "Seller not found or KYC not approved" });
        // }
        // const sellerId = seller._id;
        const sellerId = "69930f6dbc49845122265455";

        const [
            totalProducts,
            totalOrders,
            deliveredOrders,
            cancelledOrders,
            shippedOrders,
            returnedOrders,
            pendingOrders,
            lowstock,
            revenue,
            wallet
        ] = await Promise.all([
            productModel.countDocuments({ sellerId }),
            orderModal.countDocuments({ sellerId }),
            orderModal.countDocuments({ sellerId, orderStatus: "delivered" }),
            orderModal.countDocuments({ sellerId, orderStatus: "cancelled" }),
            orderModal.countDocuments({ sellerId, orderStatus: "shipped" }),
            orderModal.countDocuments({ sellerId, orderStatus: "returned" }),
            orderModal.countDocuments({ sellerId, orderStatus: { $in: ["placed", "confirmed", "packed"] } }),
            productModel.countDocuments({ sellerId, stock: { $lt: 5 } }),
            orderModal.aggregate([{ $match: { sellerId, paymentStatus: "paid" } },
            { $group: { _id: null, total: { $sum: "$sellerAmount" } } }
            ]),
            walletSystemModal.findOne({ ownerId: req.user.id, ownerType: "seller" })
        ]);

        res.json({
            success: true,
            data: {
                totalProducts,
                totalOrders,
                deliveredOrders,
                cancelledOrders,
                shippedOrders,
                returnedOrders,
                pendingOrders,
                lowstock,
                totalRevenue: revenue[0]?.total || 0,
                walletBalance: wallet?.availableBalance || 0,
                lockedBalance: wallet?.lockedBalance || 0
            }
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
