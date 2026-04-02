import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import http from "http";
import adminRoutes from "./routes/admin.routes.js";
import authRoute from "./routes/auth.route.js";
import categoryRoute from "./routes/category.routes.js";
import addvarintRoute from "./routes/addvariantroute.js";
import subcategoryRoute from "./routes/subcategory.js";
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
import walletTrancation from "./routes/ReportsRoute/report.route.js";
import addresRouter from "./routes/address.router.js";
import withdrawalReq from "./routes/withdrawal.routes.js";
import multer from "multer";
const app = express();
import { initSocket } from "./config/socket.js";
import { setupBullBoard } from "./QueueMonitoring/MonitoringQu.js";
import testRouter from "./routes/TestRoute/test.route.js";
const server = http.createServer(app);
dotenv.config();
connectDB();
setupBullBoard(app);

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
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
initSocket(server);

// app.use(cors("*"));
app.use(express.json());
// test routes elastic search and redis and welcome message
app.use("/api/test", testRouter);
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
// withdrawal request
app.use("/api/withdrawalreq", withdrawalReq)
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
app.use("/api/address", addresRouter);
// Lead route
app.use("/api/leads", leadrouter)

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // console.error("Multer Error:", err);
        return res.status(400).json({
            success: false,
            message: "File upload error: " + err.message
        });
    }
    if (err) {
        // console.error("Error:", err);
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    next();
});

export default app;


server.listen(5000, () => {
    console.log("Server running on port 5000");
});
