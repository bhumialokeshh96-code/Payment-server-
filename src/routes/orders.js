// routes/orders.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order'); // assume Order model exists
const logger = require('../config/logger');

// POST /api/orders - Create new order
router.post('/', async (req, res) => {
    try {
        const { customer_phone, order_amount } = req.body;

        // ✅ Validation
        if (!customer_phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'Mobile number is required' 
            });
        }

        if (!order_amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Amount is required' 
            });
        }

        // ✅ Validate phone number (10 digits)
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(customer_phone)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid mobile number. Must be 10 digits.' 
            });
        }

        // ✅ Validate amount (optional - agar fixed amounts hi allow karne hain)
        const allowedAmounts = [600, 1200, 1500, 2000, 3000];
        if (!allowedAmounts.includes(Number(order_amount))) {
            return res.status(400).json({ 
                success: false, 
                message: 'Amount must be one of: 600, 1200, 1500, 2000, 3000' 
            });
        }

        // Create order in database
        const newOrder = new Order({
            customer_phone,
            order_amount: Number(order_amount),
            status: 'PENDING',
            createdAt: new Date()
        });

        await newOrder.save();

        // Call Cashfree API to create payment order
        const cashfreeOrder = await createCashfreeOrder({
            order_id: newOrder._id.toString(),
            order_amount: newOrder.order_amount,
            customer_phone: newOrder.customer_phone
        });

        // Update order with cashfree details
        newOrder.cashfree_order_id = cashfreeOrder.order_id;
        newOrder.payment_link = cashfreeOrder.payment_link;
        await newOrder.save();

        res.json({
            success: true,
            order_id: newOrder._id,
            payment_link: cashfreeOrder.payment_link,
            message: 'Order created successfully'
        });

    } catch (error) {
        logger.error('Order creation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create order' 
        });
    }
});

// Helper function to call Cashfree API
async function createCashfreeOrder(orderData) {
    // Cashfree API integration logic here
    // Use cashfreeConfig from config/cashfree.js
    // Return object with order_id and payment_link
}

module.exports = router;
