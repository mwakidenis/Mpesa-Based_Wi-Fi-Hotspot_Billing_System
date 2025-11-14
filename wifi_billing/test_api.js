const fetch = require('node-fetch');

async function testSupportAPI() {
  try {
    // Test getting user support requests
    const phone = '0708114896'; // The phone from the latest request
    const response = await fetch(`http://localhost:5000/api/support/user/requests?phone=${phone}`);
    const data = await response.json();

    console.log('API Response:', data);
    console.log('Success:', data.success);
    if (data.success && data.data) {
      console.log('Requests found:', data.data.length);
      data.data.forEach(req => {
        console.log(`- ID: ${req.id}, Status: ${req.status}, Message: ${req.message.substring(0, 50)}...`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testSupportAPI();