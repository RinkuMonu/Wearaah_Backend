import axios from "axios";

export const sendSellerEmail = async ({
    userName,
    userEmail,
    templateId,
    reason = ""
}) => {
    try {
        const time = new Date().toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
        const payload = {
            recipients: [
                {
                    to: [{ name: userName, email: userEmail }],
                    variables: {
                        userName,
                        reason,
                        time,
                        year: new Date().getFullYear()
                    }
                }
            ],
            from: {
                name: "Lionies",
                email: "info@lionies.com"
            },
            domain: "mail.sevenunique.com",
            template_id: templateId
        };

        await axios.post(
            "https://control.msg91.com/api/v5/email/send",
            payload,
            {
                headers: {
                    authkey: process.env.MSG91_AUTH_KEY,
                    "Content-Type": "application/json"
                }
            }
        );
    } catch (err) {
        console.log("Email error", err.message);
    }
};



export const sendInvoiceEmail = async ({ variables }) => {
    try {

        const itemsTable = (variables.items || []).map(item => `
      <tr>
        <td>${item.variantName || ""}</td>
        <td>${item.sku || ""}</td>
        <td>${item.hsnCode || "N/A"}</td>
        <td>${item.quantity || 0}</td>
        <td>₹${Number(item.mrp || 0).toFixed(2)}</td>
        <td>${item.discountPercent || 0}%</td>
        <td>₹${Number(item.sellingPrice || 0).toFixed(2)}</td>
        <td>₹${Number(item.subtotal || 0).toFixed(2)}</td>
        <td><strong>₹${Number(item.total || 0).toFixed(2)}</strong></td>
      </tr>
    `).join("");



        const payload = {
            recipients: [
                {
                    to: [{ email: variables.customer_email }],
                    variables: {
                        shop_name: variables.shop_name,
                        shop_address: variables.shop_address,
                        shop_gstin: variables.shop_gstin,

                        invoice_number: variables.invoice_number,
                        invoice_date: variables.invoice_date,

                        customer_name: variables.customer_name,
                        customer_mobile: variables.customer_mobile,
                        customer_email: variables.customer_email,

                        items_table: itemsTable,

                        subtotal: Number(variables.subtotal || 0).toFixed(2),
                        cgst_total: Number(variables.cgst_total || 0).toFixed(2),
                        sgst_total: Number(variables.sgst_total || 0).toFixed(2),
                        gst_amount: Number(variables.gst_amount || 0).toFixed(2),

                        total_discount: Number(variables.total_discount || 0).toFixed(2),

                        grand_total: Number(variables.grand_total || 0).toFixed(2),

                        payment_mode: variables.payment_mode
                    }
                }
            ],

            from: {
                name: "Finunique Small private Limited",
                email: "no-reply@finuniques.in"
            },

            domain: "finuniques.in",
            template_id: "offline_Invoice_Gen_temp"
        };


        await axios.post(
            "https://api.msg91.com/api/v5/email/send",
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    authkey: process.env.MSG91_AUTH_KEY
                }
            }
        );

    } catch (error) {
        console.error("Invoice Email Error:", error.response?.data || error.message);
    }
};



export const sendOrderPlacedEmail = async ({ userName, email, order, }) => {
    try {

        // items html
        const items = order.items
            .map(
                (item) => `
<tr>
<td style="border:1px solid #eee">${item.productName}</td>
<td style="border:1px solid #eee">${item.size}</td>
<td style="border:1px solid #eee">${item.color}</td>
<td style="border:1px solid #eee" align="center">${item.quantity}</td>
<td style="border:1px solid #eee" align="right">₹${item.sellingPrice}</td>
<td style="border:1px solid #eee" align="right">₹${item.totalAmountofqty}</td>
</tr>`
            )
            .join("");

        const payload = {
            recipients: [
                {
                    to: [
                        {
                            name: userName || "User",
                            email: email
                        }
                    ],
                    variables: {

                        customerName: userName || "User",

                        orderNumber: order.orderNumber,

                        orderDate: new Date(order.createdAt).toLocaleString("en-IN"),

                        paymentMethod: order.paymentMethod,

                        paymentStatus: order.paymentStatus,

                        fullName: order.shippingAddress.fullName,
                        street: order.shippingAddress.street,
                        landmark: order.shippingAddress.landmark,
                        city: order.shippingAddress.city,
                        state: order.shippingAddress.state,
                        pincode: order.shippingAddress.pincode,
                        mobile: order.shippingAddress.mobile,

                        subtotal: order.totalAmount,
                        deliveryCharge: order.deliveryCharge,
                        coinUsed: order.coinUsed,
                        finalAmount: order.finalAmoutAfterCoinDeliverycharges,

                        items,

                        year: new Date().getFullYear()
                    }
                }
            ],

            from: {
                name: "Wearaah",
                email: "info@wearaah.com"
            },

            domain: "mail.sevenunique.com",

            template_id: process.env.MSG91_ORDER_TEMPLATE_ID
        };

        await axios.post(
            "https://control.msg91.com/api/v5/email/send",
            payload,
            {
                headers: {
                    authkey: process.env.MSG91_AUTH_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Order email sent:", order.orderNumber);

    } catch (err) {
        console.log("Order email error:", err.message);
    }
};



