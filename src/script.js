// Bulk-purchase automation
document.getElementById('product').addEventListener('change', function() {
      if (this.value === 'bulk-purchase') {
        document.getElementById('quantity').value = 1000;
      } else if (this.value === 'sachet-water') {
        document.getElementById('quantity').value = '';
      }
    });

// Check URL parameters on page load
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('product') === 'bulk-purchase') {
  document.getElementById('product').value = 'bulk-purchase';
  document.getElementById('product').dispatchEvent(new Event('change'));
}