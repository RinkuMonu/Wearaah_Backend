import { Worker } from "bullmq";
import redis from "../../middlewares/redis.js";
import orderModal from "../../models/order.modal.js";
import productVariantModel from "../../models/productVariant.model.js";
import walletSystemModal from "../../models/walletSystem.modal.js";
import WalletTransactionModal from "../../models/WalletTransaction.modal.js";
import { sendInvoiceEmail } from "../../service/mailsend.js";
import connectDB from "../../config/db.js";

await connectDB();

const orderWorker = new Worker(
    "orderQueue",
    async (job) => {
        console.log("Processing job:", job.name);

        if (job.name === "order_offline_Purchase_send_mail") {
            try {
                await sendInvoiceEmail({
                    variables: job.data
                });
            } catch (err) {
                console.error("Email failed:", err.message);
                throw err;
            }
        }

        if (job.name === "order_cancelled") {
            try {
                const {
                    items,
                    walletRefund,
                    upiRefund,
                    userId,
                    orderId,
                    orderNumber
                } = job.data;

                const order = await orderModal.findOneAndUpdate(
                    { _id: orderId, refundStatus: "pending" },
                    { $set: { refundStatus: "processing" } },
                    { new: true }
                );

                if (!order) {
                    console.log(`Already processed or in-progress: ${orderNumber}`);
                    return;
                }

                const bulkOps = items.map(item => ({
                    updateOne: {
                        filter: { _id: item.variantId },
                        update: { $inc: { stock: item.quantity } }
                    }
                }));

                if (bulkOps.length > 0) {
                    await productVariantModel.bulkWrite(bulkOps);
                }

                if (walletRefund > 0) {

                    const existing = await WalletTransactionModal.findOne({
                        referenceId: orderId,
                        type: "credit",
                        reasonSource: "refund"
                    });

                    if (existing) {
                        console.log(`Wallet refund already done for order ${orderNumber}`);
                    } else {
                        const wallet = await walletSystemModal.findOneAndUpdate(
                            { ownerId: userId },
                            { $inc: { availableBalance: walletRefund } },
                            { new: true }
                        );

                        if (!wallet) {
                            throw new Error("Wallet not found during refund");
                        }

                        await WalletTransactionModal.create([{
                            walletId: wallet._id,
                            ownerId: userId,
                            type: "credit",
                            reasonSource: "refund",
                            description: `Refund for cancelled order ${orderNumber}`,
                            amount: walletRefund,
                            referenceId: orderId,
                            referenceModel: "Order",
                            status: "completed",
                            balanceAfter: wallet.availableBalance
                        }]);
                    }
                }

                if (upiRefund > 0) {
                    console.log(`Initiate PG refund: ${upiRefund} for order ${orderNumber}`);

                }

                await orderModal.updateOne(
                    { _id: orderId, refundStatus: "processing" },
                    {
                        $set: {
                            refundStatus: "completed",
                            refundedAt: new Date()
                        }
                    }
                );

                console.log(`Refund completed for order ${orderNumber}`);

            } catch (error) {
                console.error("Error in order cancel worker:", error);
                await orderModal.updateOne(
                    { _id: job.data?.orderId },
                    { $set: { refundStatus: "pending" } }
                );

                throw error;
            }
        }
    },
    {
        connection: redis,
        concurrency: 5
    }
);


orderWorker.on("completed", job => {
    console.log(`Job ${job.id} completed`);
});

orderWorker.on("failed", (job, err) => {
    console.error(`Job ${job.id} failed`, err.message);
});