import { Queue } from "bullmq";
import redis from "../../middlewares/redis.js";

const orderQueue = new Queue("orderQueue", {
    connection: redis,
    defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 3000
        }
    }
});

export default orderQueue;