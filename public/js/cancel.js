'use strict';

/**
 * Cancel Page Handler
 * Displays cancelled payment details and handles user actions
 */

// ── DOM Elements ──────────────────────────────────────────────────────────

const orderIdEl = document.getElementById('orderId');
const amountEl = document.getElementById('amount');
const timestampEl = document.getElementById('timestamp');
const statusBadgeEl = document.getElementById('statusBadge');
const alertBoxEl = document.getElementById('alertBox');
const viewDetailsBtn = document.getElementById('viewDetailsBtn');

// ── Helpers ───────────────────────────────────────────────────────────────

function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function showAlert(message, type = 'info') {
  alertBoxEl.textContent = message;
  alertBoxEl.className = `alert ${type}`;
  setTimeout(() => {
    alertBoxEl.className = 'alert';
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(text)));
  return div.innerHTML;
}

function formatCurrency(amount, currency = 'INR') {
  const currencySymbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
  };
  const symbol = currencySymbols[currency] || currency;
  return `${symbol}${Number(amount).toFixed(2)}`;
}

// ── Fetch Order Details ───────────────────────────────────────────────────

async function fetchOrderDetails(orderId) {
  try {
    const response = await fetch(`/api/orders/${orderId}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      console.warn('Could not fetch order details:', data.message);
      return null;
    }

    return data.data;
  } catch (err) {
    console.error('Error fetching order details:', err);
    return null;
  }
}

// ── Initialize Page ──────────────────────────────────────────────────────

async function init() {
  const orderId = getQueryParam('order_id');

  // ✅ अगर order ID नहीं है
  if (!orderId) {
    showAlert('❌ No order ID found in URL. Please try again.', 'error');
    orderIdEl.textContent = 'N/A';
    return;
  }

  // ✅ Order ID को display करो
  orderIdEl.textContent = escapeHtml(orderId);

  // ✅ Timestamp set करो
  const now = new Date();
  timestampEl.textContent = now.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  // ✅ Order details fetch करो
  try {
    const orderDetails = await fetchOrderDetails(orderId);

    if (orderDetails) {
      // ✅ Amount display करो
      amountEl.textContent = formatCurrency(orderDetails.amount, orderDetails.currency);

      // ✅ Status badge update करो
      const statusText = orderDetails.status || 'CANCELLED';
      statusBadgeEl.textContent = statusText;

      // ✅ Status के अनुसार color change करो
      if (statusText === 'FAILED' || statusText === 'USER_DROPPED') {
        statusBadgeEl.style.background = '#f8d7da';
        statusBadgeEl.style.color = '#721c24';
      }

      // ✅ View details button दिखाओ
      viewDetailsBtn.style.display = 'inline-block';
      viewDetailsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showOrderDetailsModal(orderDetails);
      });

      console.log('✅ Payment cancelled successfully for Order ID:', orderId);
    } else {
      showAlert('⚠️ Could not load complete order details.', 'info');
    }
  } catch (err) {
    console.error('Error during initialization:', err);
    showAlert('⚠️ An error occurred while loading details.', 'error');
  }
}

// ── Show Order Details Modal ──────────────────────────────────────────────

function showOrderDetailsModal(orderDetails) {
  const modalHtml = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    ">
      <div style="
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      ">
        <h3 style="color: #333; margin-bottom: 20px;">📋 Order Details</h3>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <p style="margin: 10px 0;"><strong>Order ID:</strong> ${escapeHtml(orderDetails.orderId)}</p>
          <p style="margin: 10px 0;"><strong>Amount:</strong> ${formatCurrency(orderDetails.amount, orderDetails.currency)}</p>
          <p style="margin: 10px 0;"><strong>Status:</strong> <span style="color: #ffc107; font-weight: bold;">${escapeHtml(orderDetails.status)}</span></p>
          <p style="margin: 10px 0;"><strong>Customer:</strong> ${escapeHtml(orderDetails.customerDetails.customerName)}</p>
          <p style="margin: 10px 0;"><strong>Email:</strong> ${escapeHtml(orderDetails.customerDetails.customerEmail)}</p>
          <p style="margin: 10px 0;"><strong>Phone:</strong> ${escapeHtml(orderDetails.customerDetails.customerPhone)}</p>
          <p style="margin: 10px 0;"><strong>Created:</strong> ${new Date(orderDetails.createdAt).toLocaleString('en-IN')}</p>
        </div>

        <div style="display: flex; gap: 10px;">
          <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
            flex: 1;
            padding: 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
          ">Close</button>
          <button onclick="copyToClipboard('${orderDetails.orderId}')" style="
            flex: 1;
            padding: 10px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
          ">📋 Copy Order ID</button>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHtml;
  document.body.appendChild(container);
}

// ── Copy to Clipboard ──────────────────────────────────────────────────���──

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showAlert('✅ Order ID copied to clipboard!', 'info');
  });
}

// ── Page Load ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
