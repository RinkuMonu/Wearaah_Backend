import { Worker } from "bullmq";
import redis from "../../middlewares/redis.js";
import orderModal from "../../models/order.modal.js";
import { sendOrderPlacedEmail } from "../../service/mailsend.js";

const orderWorker = new Worker(
    "orderQueue",
    async (job) => {
        // console.log("jobbbb", job)
        console.log("Processing job:", job.name);

        if (job.name === "order_place_send_mail") {

            const { orderId } = job.data;
            console.log(orderId)

            const order = await orderModal
                .findById(orderId)
                .populate("customerId", "email name").lean();

            if (!order) return;

            const email = order.customerId.email;
            const userName = order.customerId.name;

            // await sendOrderPlacedEmail({
            //     userName,
            //     email,
            //     order
            // });

            console.log("worker done placed email sent:", order.orderNumber);
        }

        if (job.name === "accepted_by_seller_notify_customer") {

            const { orderId } = job.data;

            console.log("Send accept email to customer for order:", orderId);

            // await sendInvoiceEmail(orderId)

        }

        if (job.name === "assignRider") {

            const { orderId } = job.data;

            console.log("Finding rider for order:", orderId);

            // rider assignment logic

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