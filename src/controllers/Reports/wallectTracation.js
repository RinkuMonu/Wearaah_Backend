import WalletTransactionModal from "../../models/WalletTransaction.modal.js";

export const getWalletTransactions = async (req, res) => {
    try {

        const {
            page = 1,
            limit = 10,
            type,
            reasonSource,
            status,
            referenceId,
            fromDate,
            search,
            toDate,
            minAmount,
            maxAmount
        } = req.query;

        let filter = {};
        if (req.user.role !== "superadmin") {
            filter.ownerId = req.user.id
        }
        if (search) {
            filter.$or = [
                { transactionId: { $regex: search, $options: "i" } },
            ];
        }
        if (type) filter.type = type;
        if (reasonSource) filter.reasonSource = reasonSource;
        if (status) filter.status = status;
        if (referenceId) filter.referenceId = referenceId;

        if (minAmount || maxAmount) {
            filter.amount = {};
            if (minAmount) filter.amount.$gte = Number(minAmount);
            if (maxAmount) filter.amount.$lte = Number(maxAmount);
        }

        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) filter.createdAt.$gte = new Date(fromDate);
            if (toDate) filter.createdAt.$lte = new Date(toDate);
        }

        const skip = (page - 1) * limit;

        const [transactions, total, stats] = await Promise.all([

            WalletTransactionModal
                .find(filter)
                .populate("ownerId", "name platformId mobile")
                .populate("walletId", "availableBalance superCoinBalance")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            WalletTransactionModal.countDocuments(filter),
            WalletTransactionModal.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,

                        totalCreditAmount: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$type", "credit"] },
                                    "$amount",
                                    0
                                ]
                            }
                        },

                        totalDebitAmount: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$type", "debit"] },
                                    "$amount",
                                    0
                                ]
                            }
                        },

                        totalPendingAmount: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "pending"] },
                                    "$amount",
                                    0
                                ]
                            }
                        },

                        totalCompletedAmount: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "completed"] },
                                    "$amount",
                                    0
                                ]
                            }
                        },

                        totalFailedAmount: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "failed"] },
                                    "$amount",
                                    0
                                ]
                            }
                        }
                    }
                }
            ])

        ]);
        const statData = stats[0] || {};



        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: transactions,
            statData,
        });

    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};