import mongoose from "mongoose";
import InvoiceOfflineModel from "../models/InvoiceOffline.model.js";
import Order from "../models/order.modal.js";
import Product from "../models/product.model.js";
import productVariantModel from "../models/productVariant.model.js";
import ProductVariant from "../models/productVariant.model.js";
import sellerModal from "../models/roleWiseModal/seller.modal.js";
import counterModel from "../models/counter.model.js";
import orderModal from "../models/order.modal.js";
import orderQueue from "../queues/orderQueues/order.queue.js";
import walletSystemModal from "../models/walletSystem.modal.js";
import superCoin from "../models/superCoin.js";
import WalletTransactionModal from "../models/WalletTransaction.modal.js";
import { getIO } from "../config/socket.js";

// place order by customer
export const createOrder = async (req, res) => {
  let session;
  try {

    const { items, shippingAddress, paymentMethod, coinUsed = 0, walletUsed = 0 } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ message: "Order items required" });
    /* -----------------------------
   STEP 0: Super coin validation
------------------------------*/
    session = await mongoose.startSession();
    session.startTransaction();
    let wallet;
    console.log(req.user)
    console.log(wallet)
    if (coinUsed > 0) {
      wallet = await walletSystemModal.findOneAndUpdate(
        { ownerId: req.user.id, status: "active", superCoinBalance: { $gte: coinUsed } },
        { $inc: { superCoinBalance: -coinUsed } },
        { new: true, session }
      );
      // ownerType: "customer",
      if (!wallet) {
        throw new Error("insufficient super coins");
      }

    }


    let orderItems = [];
    let totalAmount = 0;
    let finalAmount = 0;
    let sellerAmount = 0;
    let platformCommission = 0;
    let deliveryCharge = 0;
    let hasPaidDelivery = false;
    let sellerId = null;
    let walletUsedAmount = 0;
    const variantIds = items.map(i => i.variant);

    /* -----------------------------
       STEP 2: Bulk fetch products & variants
       sirf 2 DB queries lagenge
    ------------------------------*/

    const variants = await ProductVariant
      .find({ _id: { $in: variantIds } }).session(session)
      .select("variantTitle size color sku stock pricing status isActive productId sellerId")
      .populate({
        path: "productId",
        select: "isdeliveryFree saleCount",
        options: { session }
      })

    // console.log(variants)

    /* -----------------------------
       STEP 3: Create Map for fast lookup
       DB dobara hit nahi hogi
    ------------------------------*/

    const variantMap = new Map(
      variants.map(v => [v._id.toString(), v])
    );
    let variantBulkOps = [];
    let productSales = new Map();

    /* -----------------------------
       STEP 4: Process each item
    ------------------------------*/

    for (let i of items) {

      const variant = variantMap.get(i.variant.toString());
      if (!variant) {
        throw new Error("Product or Variant not found");
      }
      const product = variant.productId;


      if (!sellerId) {
        sellerId = variant.sellerId;
      }

      // multi seller block
      if (sellerId.toString() !== variant.sellerId.toString()) {
        return res.status(400).json({
          message: "Multiple shop product in one order not allowed"
        });
      }

      if (variant.status !== "approved" || variant.isActive == false) {
        return res.status(400).json({
          message: `${variant.variantTitle} not available for purchase, Please remove this time`
        });
      }

      if (variant.stock < i.quantity) {
        return res.status(400).json({ success: false, message: `Stock changed, Insufficient stock- ${variant.variantTitle} - ${variant.sku}` });
      }

      console.log(variant.productId.isdeliveryFree)

      if (!variant?.productId?.isdeliveryFree) {
        hasPaidDelivery = true
      }
      /* -----------------------------
         Atomic stock update
         race condition avoid
      ------------------------------*/

      variantBulkOps.push({
        updateOne: {
          filter: { _id: variant._id, stock: { $gte: i.quantity } },
          update: { $inc: { stock: -i.quantity } }
        }
      });

      /* -----------------------------
         Line price calculation
      ------------------------------*/

      const lineTotal = variant?.pricing?.sellingPrice * i.quantity;

      totalAmount += lineTotal;

      /* -----------------------------
         Snapshot store in order
         future product change safe
      ------------------------------*/

      orderItems.push({
        productId: product._id,
        variantId: variant._id,
        productName: variant.variantTitle,
        size: variant.size,
        color: variant.color,
        mrp: variant?.pricing?.mrp,
        sellingPrice: variant?.pricing?.sellingPrice,
        quantity: i.quantity,
        totalAmountofqty: lineTotal,
        sku: variant.sku
      });

      /* -----------------------------
         Product sale count update
      ------------------------------*/

      const pid = product._id.toString();

      productSales.set(
        pid,
        (productSales.get(pid) || 0) + i.quantity
      );

    }

    if (variantBulkOps.length > 0) {

      const variantResult = await ProductVariant.bulkWrite(
        variantBulkOps,
        { session }
      );

      if (variantResult.matchedCount !== variantBulkOps.length) {
        throw new Error("Stock update failed for some variants");
      }

    }
    /* -----------------------------
       BULK UPDATE PRODUCT SALE COUNT
    ------------------------------*/

    if (productSales.size > 0) {

      const bulkOps = [];

      for (const [productId, qty] of productSales) {
        bulkOps.push({
          updateOne: {
            filter: { _id: productId },
            update: { $inc: { saleCount: qty } }
          }
        });
      }

      await Product.bulkWrite(bulkOps, { session });
    }
    //  STEP 5: Delivery charge logic
    if (hasPaidDelivery) {
      deliveryCharge = 50;
    }
    // STEP 7: Platform commission

    const commissionPercent = 10;

    platformCommission =
      Number((totalAmount * commissionPercent / 100).toFixed(2));

    // STEP 8: Seller amount

    sellerAmount =
      Number((totalAmount - platformCommission).toFixed(2));


    // STEP 9: Final payable amount jo customer krega pay

    const discountedAmount = totalAmount - coinUsed;
    finalAmount =
      Number((discountedAmount + deliveryCharge).toFixed(2));

    let gatewayAmount = finalAmount;

    if (walletUsed > 0) {
      wallet = await walletSystemModal.findOne({
        ownerId: req.user.id,
        status: "active"
      }).session(session);

      if (!wallet) {
        throw new Error("Wallet not found");
      }
      walletUsedAmount = Math.min(wallet.availableBalance, finalAmount);
      await walletSystemModal.updateOne(
        {
          _id: wallet._id,
          availableBalance: { $gte: walletUsedAmount }
        },
        {
          $inc: { availableBalance: -walletUsedAmount }
        },
        { new: true, session }
      );
      gatewayAmount = finalAmount - walletUsedAmount;

    }
    console.log("gatewayAmount", gatewayAmount)
    /* -----------------------------
         STEP 10: Create Order
      ------------------------------*/

    const order = new Order({
      customerId: req.user.id,
      sellerId,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "pending" : "paid",
      totalAmount,
      deliveryCharge,
      coinUsed,
      walletUsed: walletUsedAmount,
      finalAmoutAfterCoinDeliverycharges: finalAmount,
      gatewayAmount,
      platformCommission,
      sellerAmount,
    });

    await order.save({ session });

    if (walletUsedAmount > 0) {
      const updatedWallet = await walletSystemModal.findById(wallet._id).select("availableBalance").session(session);
      await WalletTransactionModal.create([{
        walletId: wallet._id,
        ownerId: req.user.id,
        type: "debit",
        reasonSource: "order_payment",
        description: `order payement for order no ${order.orderNumber}`,
        amount: walletUsedAmount,
        referenceId: order._id,
        referenceModel: "Order",
        status: "completed",
        balanceAfter: updatedWallet.availableBalance
      }], { session });

    }
    if (coinUsed > 0) {
      await superCoin.create([{
        userId: req.user.id,
        type: "debit",
        amount: coinUsed,
        source: "order_use",
        orderId: order._id,
        balanceAfter: wallet.superCoinBalance,
        description: `order payement for order no ${order.orderNumber}`,
      }], { session })

    }
    await session.commitTransaction();
    session.endSession();

    const io = getIO();

    io.to(String(sellerId)).emit("new_order", {
      orderId: order._id,
      orderNumber: order.orderNumber,
    });


    await orderQueue.add("order_place_send_mail", {
      orderId: order._id,
    });

    res.status(201).json({
      message: "Order placed successfully",
      order
    });

  } catch (error) {
    console.log("order create error >", error)

    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    session?.endSession();

    return res.status(500).json({
      success: false,
      message: "Order creation failed",
      error: error.message
    });
  }
};

// Order Cancel
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ message: "Please provide a reason for cancelling the order." });
    }

    const order = await orderModal.findById(id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    // bkl order khud ka hona chahiye
    if (order.customerId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // chutiya fruad to nhi kr rha hna
    if (order.orderStatus === "cancelled" || order.paymentStatus === "refunded") {
      return res.status(400).json({ message: "Order already cancelled & refunded" });
    }

    // mkc bar bar cancal ni hona chahiye
    if (["shipped", "delivered"].includes(order.orderStatus)) {
      return res.status(400).json({
        message: "Order cannot be cancelled at this moment"
      });
    }

    // 💰 refund calculation
    let walletRefund = 0;
    let upiRefund = 0;
    if (order.paymentStatus === "paid") {
      walletRefund = order.walletUsed || 0;
      upiRefund = order.gatewayAmount || 0;
    }
    const totalRefund = walletRefund + upiRefund;
    order.paymentStatus = "refunded";
    order.orderStatus = "cancelled";
    order.settlementStatus = "settled";
    order.cancelReason = reason;
    order.refundAmount = totalRefund;
    order.refundedAt = new Date();
    await order.save();

    await orderQueue.add("order_cancelled", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      items: order.items,
      walletRefund,
      upiRefund,
      userId: order.customerId,
      paymentMethod: order.paymentMethod
    }, {
      jobId: `cancel-${order._id}`
    });

    return res.json({
      success: true,
      message: "Order cancelled successfully"
    });

  } catch (err) {
    return res.status(500).json({
      message: err.message
    });
  }
};


// Get USER ORDERS  
export const getOrders = async (req, res) => {
  try {

    const {
      page = 1,
      limit = 10,
      orderNumber,
      customerId,
      sellerId,
      riderId,
      productId,
      orderStatus,
      settlementStatus,
      paymentMethod
    } = req.query;

    const role = req.user.role;

    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const skip = (pageNumber - 1) * pageSize;

    let match = {};

    /* -----------------------------
       ROLE BASED FILTER
    ------------------------------*/

    if (role === "customer") {
      match.customerId = req.user.id;
    }

    if (role === "seller") {
      match.sellerId = req.user.sellerId;
    }

    if (role === "rider") {
      match.riderId = req.user.riderId;
    }

    /* -----------------------------
       QUERY FILTERS
    ------------------------------*/

    if (orderNumber) {
      match.orderNumber = { $regex: orderNumber, $options: "i" };
    }

    if (customerId) {
      match.customerId = customerId;
    }

    if (sellerId) {
      match.sellerId = sellerId;
    }

    if (riderId) {
      match.riderId = riderId;
    }

    if (orderStatus) {
      match.orderStatus = orderStatus;
    }

    if (paymentMethod) {
      match.paymentMethod = paymentMethod;
    }

    if (settlementStatus) {
      match.settlementStatus = settlementStatus;
    }

    if (productId) {
      match["items.productId"] = productId;
    }

    /* -----------------------------
       PIPELINE
    ------------------------------*/

    const pipeline = [

      { $match: match },

      {
        $lookup: {
          from: "Users",
          localField: "customerId",
          foreignField: "_id",
          as: "customer"
        }
      },
      {
        $lookup: {
          from: "riders",
          localField: "riderId",
          foreignField: "_id",
          as: "rider"
        }
      },

      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: "$rider",
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $sort: { createdAt: -1 }
      },

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: pageSize }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }

    ];

    const result = await Order.aggregate(pipeline);

    const orders = result[0].data;
    const totalCount = result[0].totalCount[0]?.count || 0;

    res.json({
      success: true,
      orders,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalCount / pageSize),
      totalCount
    });

  } catch (error) {

    res.status(500).json({
      message: "Failed to fetch orders",
      error: error.message
    });

  }
};

export const getAllOrders = async (req, res) => {
  try {

    const {
      page = 1,
      limit = 10,
      orderNumber,
      customerId,
      sellerId,
      riderId,
      productId,
      orderStatus,
      settlementStatus,
      paymentMethod
    } = req.query;

    const role = req.user.role;

    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const skip = (pageNumber - 1) * pageSize;

    let match = {};

    /* -----------------------------
       ROLE BASED FILTER
    ------------------------------*/

    if (role === "customer") {
      match.customerId = req.user.id;
    }

    if (role === "seller") {
      match.sellerId = req.user.sellerId;
    }

    if (role === "rider") {
      match.riderId = req.user.riderId;
    }

    /* -----------------------------
       QUERY FILTERS
    ------------------------------*/

    if (orderNumber) {
      match.orderNumber = { $regex: orderNumber, $options: "i" };
    }

    if (customerId) {
      match.customerId = customerId;
    }

    if (sellerId) {
      match.sellerId = sellerId;
    }

    if (riderId) {
      match.riderId = riderId;
    }

    if (orderStatus) {
      match.orderStatus = orderStatus;
    }

    if (paymentMethod) {
      match.paymentMethod = paymentMethod;
    }

    if (settlementStatus) {
      match.settlementStatus = settlementStatus;
    }

    if (productId) {
      match["items.productId"] = productId;
    }

    /* -----------------------------
       PIPELINE
    ------------------------------*/

    const pipeline = [

      { $match: match },

      {
        $lookup: {
          from: "Users",
          localField: "customerId",
          foreignField: "_id",
          as: "customer"
        }
      },

      {
        $lookup: {
          from: "sellers",
          localField: "sellerId",
          foreignField: "_id",
          as: "seller"
        }
      },

      {
        $lookup: {
          from: "riders",
          localField: "riderId",
          foreignField: "_id",
          as: "rider"
        }
      },

      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $unwind: {
          path: "$seller",
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $unwind: {
          path: "$rider",
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $sort: { createdAt: -1 }
      },

      {
        $facet: {

          data: [
            { $skip: skip },
            { $limit: pageSize }
          ],

          totalCount: [
            { $count: "count" }
          ],

          stats: [
            {
              $group: {
                _id: null,

                lockedAmount: {
                  $sum: {
                    $cond: [
                      { $in: ["$orderStatus", ["placed", "accepted_by_seller", "packed", "out_for_delivery"]] },
                      "$sellerAmount",
                      0
                    ]
                  }
                },

                deliveredAmount: {
                  $sum: {
                    $cond: [
                      { $eq: ["$orderStatus", "delivered"] },
                      "$sellerAmount",
                      0
                    ]
                  }
                },

                deliveredCount: {
                  $sum: {
                    $cond: [
                      { $eq: ["$orderStatus", "delivered"] },
                      1,
                      0
                    ]
                  }
                },

                cancelledCount: {
                  $sum: {
                    $cond: [
                      { $eq: ["$orderStatus", "cancelled"] },
                      1,
                      0
                    ]
                  }
                },

                returnedCount: {
                  $sum: {
                    $cond: [
                      { $eq: ["$orderStatus", "returned"] },
                      1,
                      0
                    ]
                  }
                },

                // 🔥 TOTAL
                totalAmount: {
                  $sum: {
                    $cond: [
                      { $eq: ["$orderStatus", "delivered"] },
                      "$sellerAmount",
                      0
                    ]
                  }
                },
                totalCount: { $sum: 1 }
              }
            }
          ]
        }
      }

    ];

    const result = await Order.aggregate(pipeline);

    const orders = result[0].data;
    const totalCount = result[0].totalCount[0]?.count || 0;
    const stats = result[0].stats[0] || {};

    return res.status(200).json({
      success: true,
      orders,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalCount / pageSize),
      totalCount,

      stats: {
        lockedAmount: stats.lockedAmount,
        deliveredAmount: stats.deliveredAmount,

        deliveredCount: stats.deliveredCount,
        cancelledCount: stats.cancelledCount,
        returnedCount: stats.returnedCount,

        totalAmount: stats.totalAmount, // 
        totalCount: stats.totalCount //order total
      }
    });

  } catch (error) {

    res.status(500).json({
      message: "Failed to fetch orders",
      error: error.message
    });

  }
};

// SINGLE ORDER
export const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("items.product", "name")
    .populate("items.variant", "color size");

  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(order);
};

//offline Purchase
const generateInvoiceNumber = async (sellerPrefix, session) => {

  const counter = await counterModel.findOneAndUpdate(
    { name: `invoice_${sellerPrefix}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  const paddedSeq = counter.seq.toString().padStart(6, "0");

  return `${sellerPrefix}-INV-${paddedSeq}`;
};

//offline Purchase
export const OfflinePurchaseInvoiceGen = async (req, res) => {
  const session = await mongoose.startSession();

  try {

    const {
      items,
      customerName,
      customerMobile,
      customerEmail,
      paymentMode,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one item required"
      });
    }
    if (!customerName.trim() || !customerEmail.trim() || !customerMobile.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please fill customer details to sent invoice his mail"
      });
    }
    for (const item of items) {

      const { variantId, quantity, discountPercent = 0 } = item;

      if (!mongoose.Types.ObjectId.isValid(variantId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid variant ID"
        });
      }

      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be greater than 0"
        });
      }

      if (discountPercent < 0 || discountPercent > 90) {
        return res.status(400).json({
          success: false,
          message: "Discount must be between 0 and 90%"
        });
      }

    }

    const userId = req.user.id;

    const seller = await sellerModal
      .findOne({ userId })
      .select("shopName pickupDelivery GSTIN invoicePrefix");

    if (!seller) throw new Error("Seller not found");

    const sellerId = seller._id;

    session.startTransaction();

    let invoiceItems = [];
    let subtotalAmount = 0;
    let gstAmount = 0;
    let grandTotal = 0;
    let totalDiscount = 0;

    for (const item of items) {

      const { variantId, quantity, discountPercent = 0 } = item;

      if (quantity <= 0) {
        throw new Error("Quantity must be greater than 0");
      }

      const variant = await productVariantModel
        .findOneAndUpdate(
          {
            _id: variantId,
            sellerId,
            stock: { $gte: quantity }
          },
          { $inc: { stock: -quantity } },
          { new: true, session }
        )
        .populate({
          path: "productId",
          select: "categoryId",
          populate: {
            path: "categoryId",
            select: "taxPercent"
          }
        });

      if (!variant) {
        throw new Error("Insufficient stock");
      }

      const taxPercent = variant.productId?.categoryId?.taxPercent || 0;

      const mrp = Number(variant.pricing.mrp);

      // POS discount applied on MRP
      const sellingPrice = Number(
        (mrp - (mrp * discountPercent / 100)).toFixed(2)
      );

      const linePrice = Number((sellingPrice * quantity).toFixed(2));

      // GST inclusive extraction
      const taxableAmount = Number(
        (linePrice / (1 + taxPercent / 100)).toFixed(2)
      );

      const taxAmount = Number((linePrice - taxableAmount).toFixed(2));
      const cgstAmount = Number((taxAmount / 2).toFixed(2));
      const sgstAmount = Number((taxAmount - cgstAmount).toFixed(2));

      const discountAmount = Number(
        ((mrp * discountPercent) / 100 * quantity).toFixed(2)
      );

      totalDiscount += discountAmount;

      subtotalAmount += taxableAmount;
      gstAmount += taxAmount;
      grandTotal += linePrice;

      invoiceItems.push({
        variantId,
        variantName: variant.variantTitle,
        sku: variant.sku,
        hsnCode: variant.hsnCode || "N/A",

        quantity,

        mrp,
        sellingPrice,
        discountPercent,
        discountAmount,

        taxPercent,
        cgstPercent: taxPercent / 2,
        sgstPercent: taxPercent / 2,

        cgstAmount,
        sgstAmount,

        totaltaxAmount: taxAmount,

        subtotal: taxableAmount,
        total: linePrice
      });
    }

    const invoiceNumber = await generateInvoiceNumber(
      seller.invoicePrefix,
      session
    );

    const invoice = await InvoiceOfflineModel.create(
      [
        {
          sellerId,
          invoiceNumber,

          customerName,
          customerMobile,
          customerEmail,

          subtotal: Number(subtotalAmount.toFixed(2)),
          gstAmount: Number(gstAmount.toFixed(2)),
          grandTotal: Number(grandTotal.toFixed(2)),
          totaldiscount: Number(totalDiscount.toFixed(2)),


          paymentMode,
          items: invoiceItems
        }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await orderQueue.add("order_offline_Purchase_send_mail", {
      shop_name: seller.shopName,
      shop_address: seller.pickupDelivery?.street || "N/A",
      shop_gstin: seller.GSTIN || "N/A",
      invoice_number: invoice[0].invoiceNumber,
      invoice_date: new Date(invoice[0].createdAt).toLocaleDateString(),
      customer_name: customerName,
      customer_mobile: customerMobile,
      customer_email: customerEmail,
      items: invoiceItems,
      subtotal: subtotalAmount,
      cgst_total: Number((gstAmount / 2).toFixed(2)),
      sgst_total: Number((gstAmount / 2).toFixed(2)),
      gst_amount: gstAmount,
      total_discount: totalDiscount,
      grand_total: grandTotal,
      payment_mode: paymentMode
    }, {
      jobId: `invoice-${invoice[0].invoiceNumber}`
    })
    // {                                   // options
    //   jobId: "invoice-INV123",
    //     attempts: 3,
    //     priority: 1,
    //       backoff: {
    //     type: "exponential",
    //       delay: 2000
    //   }
    // }

    return res.status(201).json({
      success: true,
      message: "Say! Thank You To Customer",
      data: invoice[0]
    });

  } catch (error) {

    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    session.endSession();

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// GET /order/unseen
export const getUnseenOrders = async (req, res) => {
  try {
    const count = await orderModal.countDocuments({
      sellerId: req.user.id,
      isSeenBySeller: false,
    }).select("sellerId isSeenBySeller").sort({ createdAt: -1 }).lean()
    if (!count)
      console.log(count)

    res.json({
      success: true,
      count
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /order/mark-seen
export const markOrdersSeen = async (req, res) => {
  try {
    await orderModal.updateMany(
      { sellerId: req.user.id, isSeenBySeller: false },
      { isSeenBySeller: true }
    )

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// order accept by seller
export const acceptOrderBySeller = async (req, res) => {
  try {

    const { orderId } = req.params;
    const sellerId = req.user?.id;

    if (!orderId)
      return res.status(400).json({
        success: false,
        message: "Please select order"
      });

    /* -----------------------------
       Find and update order safely
       Single query → optimized
    ------------------------------*/

    const order = await orderModal.findOneAndUpdate(
      {
        _id: orderId,
        sellerId: sellerId,
        // orderStatus: "placed"
      },
      {
        $set: {
          orderStatus: "accepted_by_seller",
          acceptedAtbySeller: new Date()
        }
      },
      {
        new: true,
        lean: true
      }
    ).select("orderNumber orderStatus sellerId acceptedAtbySeller");

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found, not assigned to this seller, or already processed"
      });
    }
    // console.log(order)

    const oq = await orderQueue.add("accepted_by_seller_notify_customer", {
      orderId: order._id
    });
    console.log("oq", oq)
    /* -----------------------------
       Success response
    ------------------------------*/

    return res.status(200).json({
      success: true,
      message: "Order accepted successfully",
      order
    });

  } catch (error) {

    console.error("Accept Order Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to accept order",
      error: error.message
    });

  }
};


export const deleteOrder = async (req, res) => {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  res.json({ message: "Order deleted successfully" });
};
