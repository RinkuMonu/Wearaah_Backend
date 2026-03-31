import mongoose from "mongoose";
import withdrawalRequestModel from "../models/withdrawalRequest.model.js";
import WalletTransactionModal from "../models/WalletTransaction.modal.js";
import walletSystemModal from "../models/walletSystem.modal.js";

export const createWithdrawalRequest = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const userId = req.user.id;
        const { amount, paymentMethod, bankDetails, upiDetails } = req.body;
        if (!amount || !paymentMethod || !bankDetails) {
            throw new Error("Please fill amount, bankDetails and paymentMethod")
        }
        const parsedAmount = Number(amount);

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            throw new Error("Invalid amount");
        }
        if (paymentMethod === "bank_transfer" && !bankDetails) {
            throw new Error("Bank details required");
        }

        const wallet = await walletSystemModal.findOneAndUpdate(
            {
                ownerId: userId,
                availableBalance: { $gte: parsedAmount }
            },
            {
                $inc: {
                    availableBalance: -parsedAmount,
                    lockedBalance: +parsedAmount
                }
            },
            { new: true, session }
        );

        if (!wallet) {
            throw new Error("Insufficient balance");
        }

        const withdrawalReq = await withdrawalRequestModel.create([{
            userId,
            walletId: wallet._id,
            amount: parsedAmount,
            paymentMethod,
            bankDetails,
            upiDetails
        }], { session });

        const txn = await WalletTransactionModal.create([{
            walletId: wallet._id,
            ownerId: userId,
            type: "debit",
            reasonSource: "withdrawal",
            amount: parsedAmount,
            description: "Withdrawal Request initiated",
            referenceModel: "WithdrawalRequest",
            referenceId: withdrawalReq[0]._id,
            status: "pending",
            balanceAfter: wallet.availableBalance
        }], { session });

        withdrawalReq[0].transactionId = txn[0]._id;
        await withdrawalReq[0].save({ session });

        await session.commitTransaction();

        return res.status(201).json({
            success: true,
            message: "Request submitted",
            withdrawal: withdrawalReq[0]
        });

    } catch (error) {
        await session.abortTransaction();

        return res.status(400).json({
            success: false,
            message: error.message
        });

    } finally {
        session.endSession();
    }
};




export const getAllWithdrawal = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            status,
            fromDate,
            toDate
        } = req.query;

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        let matchStage = {};

        // 🔐 role based filter
        if (req.user.role !== "superadmin") {
            matchStage.userId = new mongoose.Types.ObjectId(req.user.id);
        }

        // status
        if (status) {
            matchStage.status = status;
        }

        // date
        if (fromDate || toDate) {
            matchStage.createdAt = {};
            if (fromDate) matchStage.createdAt.$gte = new Date(fromDate);
            if (toDate) matchStage.createdAt.$lte = new Date(toDate);
        }

        const pipeline = [
            { $match: matchStage },

            // user join (select fields only)
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    pipeline: [
                        {
                            $project: {
                                name: 1,
                                email: 1,
                                mobile: 1,
                                platformId: 1
                            }
                        }
                    ],
                    as: "user"
                }
            },
            { $unwind: "$user" },

            // transaction join (lightweight)
            {
                $lookup: {
                    from: "wallettransactions",
                    localField: "transactionId",
                    foreignField: "_id",
                    pipeline: [
                        {
                            $project: {
                                transactionId: 1,
                                amount: 1,
                                type: 1,
                                status: 1,
                                balanceAfter: 1,
                                createdAt: 1,
                                bankDetails: 1,
                            }
                        }
                    ],
                    as: "wallettransaction"
                }
            },
            {
                $unwind: {
                    path: "$wallettransaction",
                    preserveNullAndEmptyArrays: true
                }
            },

            // search
            ...(search ? [{
                $match: {
                    $or: [
                        { requestId: { $regex: search, $options: "i" } },
                        { "user.platformId": { $regex: search, $options: "i" } }
                    ]
                }
            }] : []),

            // final projection (VERY IMPORTANT for performance)
            {
                $project: {
                    requestId: 1,
                    amount: 1,
                    status: 1,
                    paymentMethod: 1,
                    createdAt: 1,
                    bankDetails: 1,

                    "user.name": 1,
                    "user._id": 1,
                    "user.email": 1,
                    "user.mobile": 1,
                    "user.platformId": 1,

                    "wallettransaction.transactionId": 1,
                    "wallettransaction.status": 1,
                    "wallettransaction.balanceAfter": 1
                }
            },

            { $sort: { createdAt: -1 } },

            {
                $facet: {
                    // 📦 paginated data
                    data: [
                        { $skip: skip },
                        { $limit: limitNum }
                    ],

                    // 🔢 total count
                    totalCount: [
                        { $count: "count" }
                    ],

                    // 📊 status stats
                    statusStats: [
                        {
                            $group: {
                                _id: "$status",
                                count: { $sum: 1 },
                                totalAmount: { $sum: "$amount" }
                            }
                        }
                    ]
                }
            }
        ];

        const result = await withdrawalRequestModel.aggregate(pipeline);

        const withdrawals = result[0].data;
        const total = result[0].totalCount[0]?.count || 0;
        const statusStatsRaw = result[0].statusStats;

        // 🔥 convert stats to object
        const stats = {
            pending: 0,
            approved: 0,
            rejected: 0,
            processed: 0,

            pendingAmount: 0,
            approvedAmount: 0,
            rejectedAmount: 0,
            processedAmount: 0
        };

        statusStatsRaw.forEach(item => {
            stats[item._id] = item.count;
            stats[`${item._id}Amount`] = item.totalAmount;
        });

        res.json({
            success: true,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),

            stats, // 🔥 UI ke liye ready

            withdrawals
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};






export const approveWithdrawal = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const withdrawalId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
            throw new Error("Invalid withdrawal ID");
        }

        // 🔥 atomic update (race condition safe)
        const withdrawal = await withdrawalRequestModel.findOneAndUpdate(
            {
                _id: withdrawalId,
                status: "pending"
            },
            {
                $set: {
                    status: "approved",
                    processedBy: req.user.id,
                    processedAt: new Date()
                }
            },
            { new: true, session }
        );

        if (!withdrawal) {
            throw new Error("Withdrawal already processed or not found");
        }

        // 🔥 payout simulate (yaha future me API call hoga)
        withdrawal.status = "processed";
        await withdrawal.save({ session });

        // 🔥 txn update
        if (withdrawal.transactionId) {
            await WalletTransactionModal.findByIdAndUpdate(
                withdrawal.transactionId,
                { status: "completed" },
                { session }
            );
        }

        await session.commitTransaction();

        return res.json({
            success: true,
            message: "Withdrawal approved & processed"
        });

    } catch (error) {
        await session.abortTransaction();

        return res.status(400).json({
            success: false,
            message: error.message
        });

    } finally {
        session.endSession();
    }
};








export const rejectWithdrawal = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const withdrawalId = req.params.id;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
            throw new Error("Invalid withdrawal ID");
        }

        if (!reason) {
            throw new Error("Rejection reason required");
        }

        // 🔥 atomic update (race safe)
        const withdrawal = await withdrawalRequestModel.findOneAndUpdate(
            {
                _id: withdrawalId,
                status: "pending"
            },
            {
                $set: {
                    status: "rejected",
                    rejectionReason: reason,
                    processedBy: req.user.id,
                    processedAt: new Date()
                }
            },
            { new: true, session }
        );

        if (!withdrawal) {
            throw new Error("Withdrawal already processed or not found");
        }

        // 🔥 wallet update (atomic)
        const wallet = await walletSystemModal.findOneAndUpdate(
            { _id: withdrawal.walletId },
            {
                $inc: {
                    availableBalance: withdrawal.amount,
                }
            },
            { new: true, session }
        );

        if (!wallet) {
            throw new Error("Wallet not found");
        }

        // 🔥 refund transaction entry
        await WalletTransactionModal.create([{
            walletId: wallet._id,
            ownerId: withdrawal.userId,
            type: "credit",
            reasonSource: "refund",
            amount: withdrawal.amount,
            description: `Withdrawal rejected (${withdrawal.requestId})`,
            referenceModel: "WithdrawalRequest",
            referenceId: withdrawal._id,
            status: "completed",
            balanceAfter: wallet.availableBalance
        }], { session });

        // 🔥 original txn update (optional but recommended)
        if (withdrawal.transactionId) {
            await WalletTransactionModal.findByIdAndUpdate(
                withdrawal.transactionId,
                { status: "failed" },
                { session }
            );
        }

        await session.commitTransaction();

        return res.json({
            success: true,
            message: "Withdrawal rejected & amount refunded"
        });

    } catch (error) {
        await session.abortTransaction();

        return res.status(400).json({
            success: false,
            message: error.message
        });

    } finally {
        session.endSession();
    }
};