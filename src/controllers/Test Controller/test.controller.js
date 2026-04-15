import redis from "../../middlewares/redis.js";

export const testRedis = async (_, res) => {
    if (!redis) {
        return res.json({ redis: "disabled by .env" });
    }
    try {
        const start = Date.now();
        await redis.ping();
        res.json({
            redis: "up",
            latency: `${Date.now() - start}ms`
        });
    } catch {
        res.status(503).json({ redis: "DOWN" });
    }
};

export const testWelcome = async (_, res) => {
    return res.json({ message: "well-come Wearaah APIs" });
};