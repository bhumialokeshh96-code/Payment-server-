const Order = require('../models/Order');
const PaymentTransaction = require('../models/PaymentTransaction');
const cashfreeService = require('../services/cashfreeService');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../config/cashfree');
const { generateId } = require('../utils/idGenerator');
const logger = require('../config/logger');

/**
 * POST /api/orders
 * Create a new payment order and initialize it with Cashfree.
 */
const createOrder = async (req, res, next) => {
  try {
    const { customerName, customerEmail, customerPhone, amount, currency = 'INR' } = req.body;

    const orderId = generateId('order');
    const customerId = generateId('cust');

    // ✅ Success और Cancel URLs को अलग-अलग set करें
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const successUrl = process.env.PAYMENT_SUCCESS_URL || `${baseUrl}/success.html`;
    const cancelUrl = process.env.PAYMENT_CANCEL_URL || `${baseUrl}/cancel.html`;

    const cashfreePayload = {
      order_id: orderId,
      order_amount: parseFloat(amount),
      order_currency: currency.toUpperCase(),
      customer_details: {
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `${successUrl}?order_id=${orderId}`,
        // ✅ Cancel URL को भी add करें - Cashfree यहाँ redirect करेगा जब user cancel करे
        notify_url: `${cancelUrl}?order_id=${orderId}`,
      },
    };

    const cashfreeResponse = await cashfreeService.createCashfreeOrder(cashfreePayload);
    logger.info('Cashfree order created', {
      order_id: cashfreeResponse.order_id,
      payment_session_id: cashfreeResponse.payment_session_id,
      order_status: cashfreeResponse.order_status,
    });

    if (!cashfreeResponse.payment_session_id) {
      logger.error('Cashfree response missing payment_session_id', cashfreeResponse);
      throw new Error('Failed to obtain payment session from Cashfree');
    }

    const order = new Order({
      orderId,
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      status: ORDER_STATUS.CREATED,
      customerDetails: {
        customerId,
        customerName,
        customerEmail,
        customerPhone,
      },
      cashfreeOrderId: cashfreeResponse.order_id,
      paymentSessionId: cashfreeResponse.payment_session_id,
      orderMeta: {
        returnUrl: cashfreePayload.order_meta.return_url,
        cancelUrl: cashfreePayload.order_meta.notify_url,
      },
    });

    await order.save();
    logger.info(`Order created: ${orderId}`);

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        paymentSessionId: order.paymentSessionId,
        cashfreeOrderId: order.cashfreeOrderId,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/orders/:orderId
 * Retrieve a stored order and optionally refresh its status from Cashfree.
 */
const getOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        customerDetails: order.customerDetails,
        cashfreeOrderId: order.cashfreeOrderId,
        paymentSessionId: order.paymentSessionId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/payments/webhook
 * Handle Cashfree webhook callbacks with signature verification.
 */
const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];

    if (!signature || !timestamp) {
      return res.status(400).json({
        success: false,
        message: 'Missing webhook signature or timestamp',
      });
    }

    const rawBody = req.rawBody;
    const isValid = cashfreeService.verifyWebhookSignature(rawBody, signature, timestamp);
    if (!isValid) {
      logger.warn('Invalid webhook signature received');
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature',
      });
    }

    const event = req.body;
    const eventType = event.type;
    const eventData = event.data || {};

    logger.info(`Webhook received: ${eventType}`);

    if (
      eventType === 'PAYMENT_SUCCESS_WEBHOOK' ||
      eventType === 'PAYMENT_FAILED_WEBHOOK' ||
      eventType === 'PAYMENT_USER_DROPPED_WEBHOOK'
    ) {
      const paymentInfo = eventData.payment || {};
      const orderInfo = eventData.order || {};
      const cfOrderId = orderInfo.order_id;

      const order = await Order.findOne({ cashfreeOrderId: cfOrderId });
      if (!order) {
        logger.warn(`Webhook received for unknown cashfree order: ${cfOrderId}`);
        return res.status(200).json({ success: true });
      }

      let paymentStatus;
      let orderStatus;
      if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
        paymentStatus = PAYMENT_STATUS.SUCCESS;
        orderStatus = ORDER_STATUS.PAID;
      } else if (eventType === 'PAYMENT_USER_DROPPED_WEBHOOK') {
        paymentStatus = PAYMENT_STATUS.USER_DROPPED;
        orderStatus = ORDER_STATUS.FAILED;
      } else {
        paymentStatus = PAYMENT_STATUS.FAILED;
        orderStatus = ORDER_STATUS.FAILED;
      }

      const transactionId = generateId('txn');
      await PaymentTransaction.create({
        transactionId,
        orderId: order.orderId,
        cfPaymentId: paymentInfo.cf_payment_id != null ? String(paymentInfo.cf_payment_id) : null,
        paymentMethod: paymentInfo.payment_method
          ? Object.keys(paymentInfo.payment_method)[0]
          : null,
        status: paymentStatus,
        amount: paymentInfo.payment_amount || order.amount,
        currency: paymentInfo.payment_currency || order.currency,
        gatewayResponse: event,
      });

      order.status = orderStatus;
      await order.save();
      logger.info(`Order ${order.orderId} updated to ${orderStatus} via webhook`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/payments/verify
 * Verify payment completion by checking Cashfree for latest order status.
 */
const verifyPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'orderId is required',
      });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const cashfreeOrder = await cashfreeService.getCashfreeOrder(order.cashfreeOrderId);
    const cfStatus = cashfreeOrder.order_status;

    let newStatus = order.status;
    if (cfStatus === 'PAID') newStatus = ORDER_STATUS.PAID;
    else if (cfStatus === 'EXPIRED') newStatus = ORDER_STATUS.EXPIRED;
    else if (cfStatus === 'ACTIVE') newStatus = ORDER_STATUS.CREATED;
    // ✅ Cancelled status को भी handle करें
    else if (cfStatus === 'CANCELLED') newStatus = ORDER_STATUS.FAILED;

    if (newStatus !== order.status) {
      order.status = newStatus;
      await order.save();
      logger.info(`Order ${orderId} status updated to ${newStatus} via verify`);
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        cashfreeStatus: cfStatus,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createOrder,
  getOrder,
  handleWebhook,
  verifyPayment,
};
