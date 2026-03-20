export const getSuperAdminDashboard = async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [
            totalUsers,
            totalCustomers,
            totalSellers,
            totalRiders,
            totalProducts,
            pendingSellerKyc,
            pendingRiderKyc,
            totalOrders,
            orderStats
        ] = await Promise.all([
            userModal.estimatedDocumentCount(),
            userModal.countDocuments({ role: "customer" }),
            sellerModal.estimatedDocumentCount(),
            riderModal.estimatedDocumentCount(),
            productModel.estimatedDocumentCount(),
            sellerModal.countDocuments({ kycStatus: "pending" }),
            riderModal.countDocuments({ kycStatus: "pending" }),
            orderModal.estimatedDocumentCount(),
            orderModal.aggregate([
                {
                    $facet: {
                        statusCounts: [
                            {
                                $group: {
                                    _id: "$orderStatus",
                                    count: { $sum: 1 }
                                }
                            }
                        ],
                        todayOrders: [
                            { $match: { createdAt: { $gte: todayStart } } },
                            { $count: "count" }
                        ],
                        revenue: [
                            { $match: { paymentStatus: "paid" } },
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: "$totalAmount" }
                                }
                            }
                        ]
                    }
                }
            ])
        ]);

        const stats = orderStats[0];

        const statusMap = {};
        stats.statusCounts.forEach(s => {
            statusMap[s._id] = s.count;
        });

        res.json({
            success: true,
            data: {
                totalUsers,
                totalCustomers,
                totalSellers,
                totalRiders,
                totalProducts,
                totalOrders,
                pendingSellerKyc,
                pendingRiderKyc,
                todayOrders: stats.todayOrders[0]?.count || 0,
                deliveredOrders: statusMap.delivered || 0,
                canceledOrders: statusMap.cancelled || 0,
                shippedOrders: statusMap.shipped || 0,
                returnedOrders: statusMap.returned || 0,
                pendingOrders:
                    (statusMap.placed || 0) +
                    (statusMap.confirmed || 0) +
                    (statusMap.packed || 0),
                totalRevenue: stats.revenue[0]?.total || 0
            }
        });

    } catch (err) {
        console.error("Error in getSuperAdminDashboard:", err);
        res.status(500).json({ message: err.message });
    }
};