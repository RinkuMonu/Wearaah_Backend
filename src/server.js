import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
// import productRoutes from "./routes/product.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoute from "./routes/auth.route.js";
import categoryRoute from "./routes/category.routes.js";
import addvarintRoute from "./routes/addvariantroute.js";
import subcategoryRoute from "./routes/subcategory.js";
import redis from "./middlewares/redis.js";

import orderRoutes from "./routes/order.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import bannerRoutes from "./routes/banner.routes.js";
import faqRoutes from "./routes/faq.routes.js";
import newsletterRoutes from "./routes/newsletter.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import couponRoutes from "./routes/coupon.routes.js";
import otproute from "./routes/otp.route.js";
import riderkycRoute from "./routes/riderKyc.route.js";
import sellerkycRoute from "./routes/sellerKyc.route.js";
import brandRoute from "./routes/brand.route.js";
import matrixDashboard from "./routes/matrix.dashboard.js";
import leadrouter from "./routes/leadControl.route.js";
import orderQueue from "./queues/orderQueues/order.queue.js";
// import "./queues/orderQueues/order.worker.js"
import walletTrancation from "./routes/ReportsRoute/report.route.js";
dotenv.config();
connectDB();

// const waitingCount = await orderQueue.getWaitingCount();
// const waiting = await orderQueue.getWaiting();
// const counts = await orderQueue.getJobCounts();
// console.log("Waiting jobs:", waitingCount);
// console.log("Waiting jobs:", waiting);
// console.log(counts);

// await orderQueue.drain();
// console.log(process.listenerCount("exit"));


const app = express();
const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];

app.use(
    cors({
        origin: function (origin, callback) {
            // allow server-to-server / postman
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

import http from "http";
import { initSocket } from "./config/socket.js";

const server = http.createServer(app);

initSocket(server);



// app.use(cors("*"));
app.use(express.json());
app.get("/", async (req, res) => {
    return res.json({ message: "well-come Wearaah" });
});
app.get("/health/redis", async (req, res) => {
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
});

//service routes
app.use("/uploads", express.static("uploads"));
app.use("/api/otp", otproute);
// auth routes
app.use("/api/auth", authRoute);
//seller routes
app.use("/api/das", matrixDashboard);
//seller routes
app.use("/api/seller", sellerkycRoute);
//rider routes
app.use("/api/rider", riderkycRoute);
//product routes
app.use("/api/brand", brandRoute);
app.use("/api/product", adminRoutes);
app.use("/api/category", categoryRoute);
app.use("/api/subcategory", subcategoryRoute);
app.use("/api/variant", addvarintRoute);
// other routes
app.use("/api/order", orderRoutes);
app.use("/api/trancation", walletTrancation);
app.use("/api/contact", contactRoutes);
app.use("/api/banner", bannerRoutes);
app.use("/api/faq", faqRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/review", reviewRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/coupon", couponRoutes);
// Lead route
app.use("/api/leads", leadrouter)


export default app;


server.listen(5000, () => {
    console.log("Server running on port 5000");
});
