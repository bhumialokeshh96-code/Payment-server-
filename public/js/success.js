'use strict';

const orderDetailsEl = document.getElementById('orderDetails');
const statusLoaderEl = document.getElementById('statusLoader');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function renderOrderDetails(data) {
  const statusClass = data.status === 'PAID' ? 'alert-success' : 'alert-error';
  orderDetailsEl.innerHTML = `
    <dl>
      <dt>Order ID</dt>
      <dd>${escapeHtml(data.orderId)}</dd>
      <dt>Amount</dt>
      <dd>₹${Number(data.amount).toFixed(2)} ${escapeHtml(data.currency)}</dd>
      <dt>Status</dt>
      <dd><span class="alert ${statusClass}" style="display:inline-block;padding:0.2rem 0.6rem;">${escapeHtml(data.status)}</span></dd>
    </dl>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(text)));
  return div.innerHTML;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function init() {
  const orderId = getQueryParam('order_id');
  if (!orderId) {
    statusLoaderEl.innerHTML = '<span style="color:#e53e3e">No order ID found in URL.</span>';
    return;
  }

  try {
    // ✅ First verify payment status with backend
    const verifyRes = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });

    const verifyData = await verifyRes.json();
    statusLoaderEl.classList.add('hidden');

    if (verifyRes.ok && verifyData.success) {
      // ✅ अगर payment FAILED या CANCELLED है, तो cancel.html पर redirect करो
      if (
        verifyData.data.status === 'FAILED' || 
        verifyData.data.status === 'USER_DROPPED' ||
        verifyData.data.status === 'CANCELLED'
      ) {
        console.log('Payment cancelled/failed, redirecting to cancel page...');
        window.location.href = `/cancel.html?order_id=${orderId}`;
        return;
      }

      // ✅ अगर payment PAID है, तो success details दिखाओ
      if (verifyData.data.status === 'PAID') {
        renderOrderDetails(verifyData.data);
        return;
      }

      // ✅ अगर कोई और status है, तो उसे भी दिखाओ
      renderOrderDetails(verifyData.data);
    } else {
      // Fallback: just fetch order details
      const orderRes = await fetch(`/api/orders/${orderId}`);
      const orderData = await orderRes.json();
      if (orderRes.ok && orderData.success) {
        // ✅ Fallback में भी status check करो
        if (
          orderData.data.status === 'FAILED' || 
          orderData.data.status === 'USER_DROPPED' ||
          orderData.data.status === 'CANCELLED'
        ) {
          console.log('Payment cancelled/failed (fallback), redirecting to cancel page...');
          window.location.href = `/cancel.html?order_id=${orderId}`;
          return;
        }
        renderOrderDetails(orderData.data);
      } else {
        orderDetailsEl.innerHTML = `<p style="color:#e53e3e">${escapeHtml(orderData.message || 'Unable to load order details.')}</p>`;
      }
    }
  } catch (err) {
    statusLoaderEl.classList.add('hidden');
    console.error('Payment verification error:', err);
    orderDetailsEl.innerHTML = '<p style="color:#e53e3e">Unable to verify payment status. Please contact support.</p>';
  }
}

init();
