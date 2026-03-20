import WalletTransactionModal from "../../models/WalletTransaction.modal.js";

export const getWalletTransactions = async (req, res) => {
    try {

        const {
            page = 1,
            limit = 10,
            type,
            reasonSource,
            status,
            ownerId,
            walletId,
            referenceId,
            fromDate,
            toDate,
            minAmount,
            maxAmount
        } = req.query;

        const filter = {};

        if (type) filter.type = type;
        if (reasonSource) filter.reasonSource = reasonSource;
        if (status) filter.status = status;
        if (ownerId) filter.ownerId = ownerId;
        if (walletId) filter.walletId = walletId;
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

        const [transactions, total] = await Promise.all([

            WalletTransactionModal
                .find(filter)
                .populate("ownerId", "name email mobile")
                .populate("walletId", "availableBalance superCoinBalance")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            WalletTransactionModal.countDocuments(filter)

        ]);

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: transactions
        });

    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};