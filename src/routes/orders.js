const express = require('express');
const router = express.Router();
const { createOrder } = require('../controllers/orderController');

// POST /api/orders/create
router.post('/create', createOrder);

module.exports = router;
