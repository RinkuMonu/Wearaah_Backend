import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import productQueue from "../queues/productQueues/product.queue.js";
import orderQueue from "../queues/orderQueues/order.queue.js";


export const setupBullBoard = (app) => {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath("/admin/queues");

    createBullBoard({
        queues: [
            new BullMQAdapter(productQueue),
            new BullMQAdapter(orderQueue)
        ],
        serverAdapter
    });

    app.use("/admin/queues", serverAdapter.getRouter());
};