'use strict';

const orderDetailsEl = document.getElementById('orderDetails');
const statusLoaderEl = document.getElementById('statusLoader');

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

// ✅ सबसे important - Payment status को सीधे check करो
async function checkPaymentStatus(orderId) {
  try {
    const response = await fetch(`/api/orders/${orderId}`);
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      return null;
    }
    
    return data.data.status;
  } catch (err) {
    console.error('Error checking payment status:', err);
    return null;
  }
}

// ✅ Redirect करो cancel page पर
function redirectToCancel(orderId) {
  console.log('🚫 Payment cancelled/failed. Redirecting to cancel page...');
  setTimeout(() => {
    window.location.href = `/cancel.html?order_id=${orderId}`;
  }, 500);
}

// ✅ Main init function
async function init() {
  const orderId = getQueryParam('order_id');
  
  if (!orderId) {
    statusLoaderEl.innerHTML = '<span style="color:#e53e3e">❌ No order ID found in URL.</span>';
    return;
  }

  try {
    // ✅ पहले order का latest status fetch करो
    const status = await checkPaymentStatus(orderId);
    
    // ✅ अगर status नहीं मिला
    if (!status) {
      statusLoaderEl.classList.add('hidden');
      orderDetailsEl.innerHTML = '<p style="color:#e53e3e">Unable to load order details.</p>';
      return;
    }

    // ✅ अगर payment cancelled/failed है
    if (status === 'FAILED' || status === 'USER_DROPPED' || status === 'CANCELLED' || status === 'EXPIRED') {
      redirectToCancel(orderId);
      return;
    }

    // ✅ अगर payment still pending है (Webhook delay हो सकती है)
    if (status === 'CREATED' || status === 'ACTIVE') {
      console.log('⏳ Payment still pending, verifying with Cashfree...');
      
      // Cashfree से verify करो
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const verifyData = await verifyRes.json();
      
      if (verifyRes.ok && verifyData.success) {
        const latestStatus = verifyData.data.status;
        
        // ✅ फिर से check करो
        if (latestStatus === 'FAILED' || latestStatus === 'CANCELLED') {
          redirectToCancel(orderId);
          return;
        }

        statusLoaderEl.classList.add('hidden');
        renderOrderDetails(verifyData.data);
        return;
      }
    }

    // ✅ अगर payment PAID है
    if (status === 'PAID') {
      statusLoaderEl.classList.add('hidden');
      
      // Final verification करो
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const verifyData = await verifyRes.json();
      if (verifyRes.ok && verifyData.success) {
        renderOrderDetails(verifyData.data);
      }
      return;
    }

    statusLoaderEl.classList.add('hidden');
    renderOrderDetails({ orderId, status, amount: 0, currency: 'INR' });

  } catch (err) {
    statusLoaderEl.classList.add('hidden');
    console.error('Payment verification error:', err);
    orderDetailsEl.innerHTML = '<p style="color:#e53e3e">⚠️ Unable to verify payment status. Please contact support.</p>';
  }
}

// ✅ Timeout के साथ init करो (Webhook को time दो)
setTimeout(init, 1000);
