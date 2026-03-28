import mongoose from "mongoose";
import withdrawalRequestModel from "../models/withdrawalRequest.model.js";
import WalletTransactionModal from "../models/WalletTransaction.modal.js";
import walletSystemModal from "../models/walletSystem.modal.js";

export const createWithdrawalRequest = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.user.id;
        const { amount, paymentMethod, bankDetails, upiDetails } = req.body;

        const wallet = await walletSystemModal.findOne({ ownerId: userId }).session(session);

        if (!wallet || wallet.balance < amount) {
            throw new Error("Insufficient balance");
        }

        // 🔥 deduct + lock
        wallet.balance -= amount;
        wallet.lockedBalance += amount;
        await wallet.save({ session });

        // create withdrawal
        const withdrawal = await withdrawalRequestModel.create([{
            userId,
            walletId: wallet._id,
            amount,
            paymentMethod,
            bankDetails,
            upiDetails
        }], { session });

        // wallet txn (lock/debit)
        const txn = await WalletTransactionModal.create([{
            walletId: wallet._id,
            ownerId: userId,
            type: "debit",
            reasonSource: "withdrawal",
            amount,
            description: "Withdrawal initiated",
            referenceModel: "WithdrawalRequest",
            referenceId: withdrawal[0]._id,
            status: "pending",
            balanceAfter: wallet.balance
        }], { session });

        // link txn
        withdrawal[0].transactionId = txn[0]._id;
        await withdrawal[0].save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            withdrawal: withdrawal[0]
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error: error.message });
    }
};


export const getMyWithdrawals = async (req, res) => {
  const withdrawals = await WithdrawalRequest.find({ userId: req.user.id })
    .sort({ createdAt: -1 });

  res.json({ withdrawals });
};



export const getAllWithdrawals = async (req, res) => {
  const withdrawals = await WithdrawalRequest.find()
    .populate("userId", "name email")
    .sort({ createdAt: -1 });

  res.json({ withdrawals });
};






export const approveWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const withdrawal = await WithdrawalRequest.findById(req.params.id).session(session);

    if (!withdrawal || withdrawal.status !== "pending") {
      throw new Error("Invalid withdrawal request");
    }

    withdrawal.status = "approved";
    withdrawal.processedBy = req.user.id;
    withdrawal.processedAt = new Date();

    await withdrawal.save({ session });

    // 🔥 payout success (simulate)
    withdrawal.status = "processed";
    await withdrawal.save({ session });

    // update txn
    await WalletTransaction.findByIdAndUpdate(
      withdrawal.transactionId,
      { status: "completed" },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: error.message });
  }
};










export const rejectWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason } = req.body;

    const withdrawal = await WithdrawalRequest.findById(req.params.id).session(session);

    if (!withdrawal || withdrawal.status !== "pending") {
      throw new Error("Invalid request");
    }

    const wallet = await Wallet.findById(withdrawal.walletId).session(session);

    // 🔥 refund
    wallet.balance += withdrawal.amount;
    wallet.lockedBalance -= withdrawal.amount;
    await wallet.save({ session });

    withdrawal.status = "rejected";
    withdrawal.rejectionReason = reason;
    withdrawal.processedBy = req.user.id;
    withdrawal.processedAt = new Date();

    await withdrawal.save({ session });

    // refund txn
    await WalletTransaction.create([{
      walletId: wallet._id,
      ownerId: withdrawal.userId,
      type: "credit",
      reasonSource: "refund",
      amount: withdrawal.amount,
      description: "Withdrawal rejected refund",
      referenceModel: "WithdrawalRequest",
      referenceId: withdrawal._id,
      status: "completed",
      balanceAfter: wallet.balance
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: error.message });
  }
};