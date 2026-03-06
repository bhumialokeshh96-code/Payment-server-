/* global Cashfree */
'use strict';

const orderForm = document.getElementById('orderForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const formError = document.getElementById('formError');

// ── Helpers ──────────────────────────────────────────────────────────────────

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.textContent = loading ? 'Processing…' : 'Proceed to Pay';
  btnSpinner.classList.toggle('hidden', !loading);
}

function showError(message) {
  formError.textContent = message;
  formError.classList.remove('hidden');
}

function hideError() {
  formError.textContent = '';
  formError.classList.add('hidden');
}

function setFieldError(fieldId, errorId, message) {
  const field = document.getElementById(fieldId);
  const errEl = document.getElementById(errorId);
  if (message) {
    field.classList.add('invalid');
    errEl.textContent = message;
  } else {
    field.classList.remove('invalid');
    errEl.textContent = '';
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

function validate(data) {
  let valid = true;

  if (!data.customerName || data.customerName.trim().length === 0) {
    setFieldError('customerName', 'nameError', 'Full name is required');
    valid = false;
  } else {
    setFieldError('customerName', 'nameError', '');
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.customerEmail || !emailRe.test(data.customerEmail)) {
    setFieldError('customerEmail', 'emailError', 'A valid email address is required');
    valid = false;
  } else {
    setFieldError('customerEmail', 'emailError', '');
  }

  const phoneRe = /^\+?[1-9]\d{7,14}$/;
  if (!data.customerPhone || !phoneRe.test(data.customerPhone.replace(/\s/g, ''))) {
    setFieldError('customerPhone', 'phoneError', 'A valid phone number is required (e.g. +919876543210)');
    valid = false;
  } else {
    setFieldError('customerPhone', 'phoneError', '');
  }

  if (!data.amount || isNaN(Number(data.amount)) || Number(data.amount) < 1) {
    setFieldError('amount', 'amountError', 'Amount must be at least ₹1');
    valid = false;
  } else {
    setFieldError('amount', 'amountError', '');
  }

  return valid;
}

// ── Cashfree redirect flow ───────────────────────────────────────────────────

function redirectToCashfree(paymentSessionId) {
  console.log('Initializing Cashfree checkout with session:', paymentSessionId);

  if (typeof window === 'undefined' || typeof window.Cashfree === 'undefined') {
    console.error('Cashfree SDK not loaded. Ensure the SDK script is included before payment.js.');
    throw new Error('Payment gateway unavailable. Please refresh the page and try again.');
  }

  try {
    const cashfree = new window.Cashfree({ mode: 'sandbox' });
    cashfree.checkout({ paymentSessionId });
  } catch (err) {
    console.error('Cashfree SDK initialization failed:', err);
    throw new Error('Failed to initialize payment. Please try again.');
  }
}

// ── Form submission ──────────────────────────────────────────────────────────

orderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const data = {
    customerName: document.getElementById('customerName').value.trim(),
    customerEmail: document.getElementById('customerEmail').value.trim(),
    customerPhone: document.getElementById('customerPhone').value.trim(),
    amount: document.getElementById('amount').value,
    currency: 'INR',
  };

  if (!validate(data)) return;

  setLoading(true);

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to create order');
    }

    const { paymentSessionId } = result.data;
    if (!paymentSessionId) {
      throw new Error('Payment session not available. Please try again.');
    }

    redirectToCashfree(paymentSessionId);
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
    setLoading(false);
  }
});
