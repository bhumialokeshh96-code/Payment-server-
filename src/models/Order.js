const mongoose = require('mongoose');
const { ORDER_STATUS } = require('../config/cashfree');

const customerDetailsSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    customerPhone: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// ✅ orderMeta schema ko properly define करो
const orderMetaSchema = new mongoose.Schema(
  {
    returnUrl: { type: String, default: null },
    cancelUrl: { type: String, default: null },  // ✅ Cancel URL को store करो
    successUrl: { type: String, default: null }, // ✅ Success URL को भी store करो
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Amount must be at least 1'],
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.CREATED,
      index: true,
    },
    customerDetails: {
      type: customerDetailsSchema,
      required: true,
    },
    cashfreeOrderId: { type: String, default: null, index: true },  // ✅ Index add करो query के लिए
    paymentSessionId: { type: String, default: null },
    // ✅ orderMeta को properly structure करो
    orderMeta: {
      type: orderMetaSchema,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Order', orderSchema);
