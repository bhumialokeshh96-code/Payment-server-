// Payment form handling
document.getElementById('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const phone = document.getElementById('customerPhone').value.trim();
  const amount = document.getElementById('amount').value;
  
  // Clear previous errors
  clearErrors();
  
  // Validate phone (10 digits)
  if (!phone || !/^\d{10}$/.test(phone)) {
    showError('phoneError', 'Please enter a valid 10-digit phone number');
    return;
  }
  
  // Validate amount
  if (!amount || amount <= 0) {
    showError('amountError', 'Please enter a valid amount');
    return;
  }
  
  // Show loading state
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');
  
  submitBtn.disabled = true;
  btnText.textContent = 'Creating Order...';
  btnSpinner.classList.remove('hidden');
  
  // Create dummy name and email from phone
  const dummyName = `User_${phone.slice(-4)}`;
  const dummyEmail = `${phone}@temp.com`;
  
  try {
    const response = await fetch('/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerName: dummyName,
        customerEmail: dummyEmail,
        customerPhone: phone,
        amount: parseFloat(amount)
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.payment_session_id) {
      // Initialize Cashfree payment
      const cashfree = new Cashfree(data.payment_session_id);
      cashfree.redirect();
    } else {
      showFormError(data.message || 'Failed to create order');
    }
  } catch (error) {
    console.error('Error:', error);
    showFormError('Network error. Please try again.');
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = 'Proceed to Pay';
    btnSpinner.classList.add('hidden');
  }
});

function showError(fieldId, message) {
  const errorSpan = document.getElementById(fieldId);
  if (errorSpan) {
    errorSpan.textContent = message;
    errorSpan.classList.add('visible');
  }
}

function clearErrors() {
  document.querySelectorAll('.error-msg').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });
  const formError = document.getElementById('formError');
  if (formError) {
    formError.classList.add('hidden');
  }
}

function showFormError(message) {
  const formError = document.getElementById('formError');
  formError.textContent = message;
  formError.classList.remove('hidden');
}
