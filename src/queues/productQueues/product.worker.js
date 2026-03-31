import { Worker } from "bullmq";
import connectDB from "../../config/db.js";
import redis from "../../middlewares/redis.js";
import productModel from "../../models/product.model.js";

await connectDB();

const productWorker = new Worker(
    "productQueue",
    async (job) => {
        console.log("Processing job:", job.name);
        if (job.name === "product_update_rating") {
            try {
                const { productId, rating } = job.data;

                const product = await productModel.findById(productId).select("rating totalRatings isTopRated");
                if (product) {
                    const newTotal = product.totalRatings + 1;

                    const newRating =
                        ((product.rating * product.totalRatings) + rating) / newTotal;

                    product.rating = Number(newRating.toFixed(2));
                    product.totalRatings = newTotal;

                    product.isTopRated = product.rating >= 4;

                    await product.save();
                }

            } catch (err) {
                console.error("Product Rating Update Error:", err.message);
                throw err;
            }
        }
    },
    {
        connection: redis,
        concurrency: 5
    }
);


productWorker.on("completed", job => {
    console.log(`Job ${job.id} completed`);
});

productWorker.on("failed", (job, err) => {
    console.error(`Job ${job.id} failed`, err.message);
});