import { Queue } from "bullmq";
import redis from "../../middlewares/redis.js";

const orderQueue = new Queue("orderQueue", {
    connection: redis,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000
        }
    }
});

export default orderQueue;