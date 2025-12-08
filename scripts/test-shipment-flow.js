/**
 * Test script to demonstrate the complete shipment creation and tracking flow
 *
 * This script demonstrates:
 * 1. Creating a new shipment (package) for a user
 * 2. Assigning a driver to the shipment
 * 3. Tracking the shipment with live location
 *
 * To run this script:
 * 1. Get a Firebase auth token for a test user (alice@test.com or bob@test.com)
 * 2. Run: node test-shipment-flow.js <FIREBASE_TOKEN>
 */

const API_BASE_URL = 'http://localhost:8080/api';

async function testShipmentFlow(firebaseToken) {
  console.log('🚀 Starting Shipment Creation and Tracking Flow Test\n');

  // Step 1: Create a new shipment
  console.log('📦 Step 1: Creating a new shipment...');
  const createResponse = await fetch(`${API_BASE_URL}/users/me/shipments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${firebaseToken}`
    },
    body: JSON.stringify({
      pickupAddress: '123 Main St, San Francisco, CA 94102',
      deliveryAddress: '456 Market St, San Francisco, CA 94103',
      totalAmount: 29.99
    })
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    console.error('❌ Failed to create shipment:', error);
    return;
  }

  const { shipment } = await createResponse.json();
  console.log('✅ Shipment created successfully!');
  console.log(`   Tracking Number: ${shipment.tracking_number}`);
  console.log(`   Shipment ID: ${shipment.id}`);
  console.log(`   Status: ${shipment.status}`);
  console.log(`   Pickup: ${shipment.pickup_address}`);
  console.log(`   Delivery: ${shipment.delivery_address}\n`);

  // Step 2: Assign a driver to the shipment
  console.log('🚗 Step 2: Assigning a driver to the shipment...');
  const assignResponse = await fetch(`${API_BASE_URL}/shipments/${shipment.id}/assign-driver`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      driverId: 1  // Using existing driver with ID 1
    })
  });

  if (!assignResponse.ok) {
    console.error('❌ Failed to assign driver');
    return;
  }

  const assignedShipment = await assignResponse.json();
  console.log('✅ Driver assigned successfully!');
  console.log(`   Status: ${assignedShipment.status}`);
  console.log(`   Driver ID: ${assignedShipment.driver_id}\n`);

  // Step 3: Track the shipment (view with user authentication)
  console.log('📍 Step 3: Tracking the shipment...');
  const trackResponse = await fetch(`${API_BASE_URL}/users/me/shipments/${shipment.id}`, {
    headers: {
      'Authorization': `Bearer ${firebaseToken}`
    }
  });

  if (!trackResponse.ok) {
    console.error('❌ Failed to track shipment');
    return;
  }

  const trackedShipment = await trackResponse.json();
  console.log('✅ Shipment tracking info:');
  console.log(`   Tracking Number: ${trackedShipment.tracking_number}`);
  console.log(`   Status: ${trackedShipment.status}`);
  console.log(`   Driver: ${trackedShipment.driver_name || 'Not assigned'}`);
  console.log(`   Vehicle: ${trackedShipment.vehicle_type || 'N/A'}`);

  if (trackedShipment.current_location) {
    console.log(`   Current Location: ${trackedShipment.current_location.latitude}, ${trackedShipment.current_location.longitude}`);
  } else {
    console.log('   Current Location: Driver location not available yet');
  }

  // Step 4: Get shipment by tracking number (public endpoint)
  console.log('\n🔍 Step 4: Looking up shipment by tracking number...');
  const publicTrackResponse = await fetch(`${API_BASE_URL}/shipments/track/${shipment.tracking_number}`);

  if (publicTrackResponse.ok) {
    const publicShipment = await publicTrackResponse.json();
    console.log('✅ Public tracking info:');
    console.log(`   Status: ${publicShipment.status}`);
    console.log(`   Pickup: ${publicShipment.pickup_address}`);
    console.log(`   Delivery: ${publicShipment.delivery_address}`);
  }

  // Step 5: List all user's shipments
  console.log('\n📋 Step 5: Listing all user shipments...');
  const listResponse = await fetch(`${API_BASE_URL}/users/me/shipments`, {
    headers: {
      'Authorization': `Bearer ${firebaseToken}`
    }
  });

  if (listResponse.ok) {
    const shipments = await listResponse.json();
    console.log(`✅ Found ${shipments.length} shipment(s) for this user`);
    shipments.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.tracking_number} - ${s.status}`);
    });
  }

  console.log('\n✨ Test completed successfully!\n');
  console.log('💡 Next steps:');
  console.log('   - Driver can update location via POST /api/location/update');
  console.log('   - Update shipment status via PATCH /api/shipments/:id/status');
  console.log('   - Subscribe to real-time updates via WebSocket at ws://localhost:8082');
}

// Main execution
const firebaseToken = process.argv[2];

if (!firebaseToken) {
  console.log('Usage: node test-shipment-flow.js <FIREBASE_TOKEN>\n');
  console.log('To get a Firebase token:');
  console.log('1. Use the get-test-token.js script');
  console.log('2. Or authenticate in your frontend app and copy the token\n');
  console.log('Example:');
  console.log('  node test-shipment-flow.js eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...\n');
  process.exit(1);
}

testShipmentFlow(firebaseToken).catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
