import { Queue } from "bullmq";
import redis from "../middlewares/redis";

const deadQueue = new Queue("deadQueue", {
    connection: redis
});

export default deadQueue;