document.addEventListener('DOMContentLoaded', function() {
  const paymentForm = document.getElementById('paymentForm');
  const amountBtns = document.querySelectorAll('.amount-btn');
  const amountInput = document.getElementById('amount');
  const mobileInput = document.getElementById('mobileNumber');
  const submitBtn = document.getElementById('submitBtn');

  // Amount button selection
  amountBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove active class from all buttons
      amountBtns.forEach(b => b.classList.remove('active'));
      
      // Add active class to clicked button
      this.classList.add('active');
      
      // Set hidden input value
      amountInput.value = this.getAttribute('data-amount');
      
      // Clear error
      document.getElementById('amountError').textContent = '';
    });
  });

  // Form submission
  paymentForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const mobileNumber = mobileInput.value.trim();
    const amount = amountInput.value;

    // Validation
    if (!mobileNumber || mobileNumber.length !== 10) {
      document.getElementById('mobileError').textContent = 'Enter valid 10-digit mobile number';
      return;
    }

    if (!amount) {
      document.getElementById('amountError').textContent = 'Please select an amount';
      return;
    }

    // Show loading state
    submitBtn.disabled = true;
    document.getElementById('btnText').classList.add('hidden');
    document.getElementById('btnSpinner').classList.remove('hidden');

    try {
      // Call backend to generate payment link
      const response = await fetch('/api/generate-payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mobileNumber: mobileNumber,
          amount: amount
        })
      });

      const data = await response.json();

      if (data.success && data.paymentLink) {
        // Redirect to payment gateway
        window.location.href = data.paymentLink;
      } else {
        document.getElementById('formError').textContent = data.message || 'Error generating payment link';
        document.getElementById('formError').classList.remove('hidden');
      }
    } catch (error) {
      document.getElementById('formError').textContent = 'Something went wrong. Please try again.';
      document.getElementById('formError').classList.remove('hidden');
      console.error('Error:', error);
    } finally {
      submitBtn.disabled = false;
      document.getElementById('btnText').classList.remove('hidden');
      document.getElementById('btnSpinner').classList.add('hidden');
    }
  });
});
