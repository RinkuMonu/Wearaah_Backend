import Redis from "ioredis";

let redis = null

if (process.env.REDIS_ENABLED == "true") {
    redis = new Redis({
        host: "127.0.0.1",
        port: 6379,
        enableOfflineQueue: true, //(no api carsh... safe mode)
        maxRetriesPerRequest: null,
        retryStrategy(times) {
            if (times > 3) {
                console.error("Redis retry limit reached, stopping retries", times);
                return null;
            }
            return times * 400;
        }
    });
    redis.on("connect", () => {
        console.log("");
    });

    redis.on("error", (err) => {
        console.error("Redis connection error:", err.message);
    });
} else {
    console.log("⚠️ Redis disabled by env");
}

export default redis;