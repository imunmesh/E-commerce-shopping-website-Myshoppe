const axios = require('axios');
require('dotenv').config();

async function checkApiResponse() {
  try {
    console.log('🔍 Checking products API response...\n');

    const response = await axios.get('http://localhost:5000/api/products?limit=2');
    
    console.log('📦 API Response structure:');
    console.log('─'.repeat(80));
    console.log('Total products:', response.data.pagination.totalItems);
    console.log('Products returned:', response.data.products.length);
    
    if (response.data.products.length > 0) {
      const firstProduct = response.data.products[0];
      console.log('\n📄 First product data:');
      console.log('─'.repeat(80));
      console.log('ID:', firstProduct.id);
      console.log('Title:', firstProduct.title);
      console.log('Thumbnail (from products table):', firstProduct.thumbnail || 'NULL');
      console.log('Images array length:', firstProduct.images ? firstProduct.images.length : 0);
      
      if (firstProduct.images && firstProduct.images.length > 0) {
        console.log('\n🖼️  Images array:');
        firstProduct.images.forEach((img, idx) => {
          console.log(`  [${idx}] URL: ${img.image_url}`);
          console.log(`      Is Primary: ${img.is_primary}`);
          console.log(`      Public ID: ${img.public_id}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

checkApiResponse();
