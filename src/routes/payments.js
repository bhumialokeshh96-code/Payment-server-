// Remove name aur email validation, sirf phone aur amount
document.getElementById('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const phone = document.getElementById('customerPhone').value.trim();
  const amount = document.getElementById('amount').value;
  
  // Sirf phone validation
  if (!phone || phone.length < 10) {
    showError('Please enter a valid 10-digit phone number');
    return;
  }
  
  if (!amount || amount <= 0) {
    showError('Please enter a valid amount');
    return;
  }
  
  // Generate dummy name and email from phone number
  const dummyName = `User_${phone.slice(-4)}`;
  const dummyEmail = `${phone}@temp.com`;
  
  const orderData = {
    customerName: dummyName,
    customerEmail: dummyEmail,
    customerPhone: phone,
    amount: parseFloat(amount)
  };
  
  // Rest of the code remains same...
  try {
    const response = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      initializePayment(data);
    } else {
      showError(data.message || 'Failed to create order');
    }
  } catch (error) {
    showError('Network error. Please try again.');
  }
});
