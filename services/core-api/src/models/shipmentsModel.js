import db from "./db.js";

export async function listShipments() {
  const result = await db.query(
    `SELECT s.id, s.status, s.package_status, s.tracking_number, s.driver_id,
            s.pickup_address, s.delivery_address,
            s.pickup_latitude, s.pickup_longitude,
            s.delivery_latitude, s.delivery_longitude,
            s.sender_name, s.sender_phone,
            s.receiver_name, s.receiver_phone,
            s.package_weight, s.package_description, s.package_details,
            s.created_at, s.updated_at,
            o.id AS order_id, o.customer_id,
            d.name AS driver_name, d.vehicle_type
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
       LEFT JOIN drivers d ON d.id = s.driver_id
       WHERE s.deleted_at IS NULL
       ORDER BY s.created_at DESC`
  );
  return result.rows;
}

export async function getShipmentById(id) {
  const result = await db.query(
    `SELECT s.*,
            o.customer_id,
            d.name AS driver_name, d.vehicle_type, d.status AS driver_status
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
       LEFT JOIN drivers d ON d.id = s.driver_id
       WHERE s.id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function getShipmentByTrackingNumber(trackingNumber) {
  const result = await db.query(
    `SELECT s.*,
            o.customer_id,
            d.name AS driver_name, d.vehicle_type, d.status AS driver_status
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
       LEFT JOIN drivers d ON d.id = s.driver_id
       WHERE s.tracking_number = $1`,
    [trackingNumber]
  );
  return result.rows[0];
}

export async function getShipmentWithLiveLocation(id) {
  const result = await db.query(
    `SELECT s.*,
            o.customer_id,
            d.id AS driver_id, d.name AS driver_name,
            d.vehicle_type, d.status AS driver_status,
            (SELECT json_build_object(
                'latitude', dle.latitude,
                'longitude', dle.longitude,
                'accuracy', dle.accuracy,
                'timestamp', dle.occurred_at
             )
             FROM driver_location_events dle
             WHERE dle.driver_id = s.driver_id
             ORDER BY dle.occurred_at DESC
             LIMIT 1) AS current_location
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
       LEFT JOIN drivers d ON d.id = s.driver_id
       WHERE s.id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function assignDriverToShipment(shipmentId, driverId) {
  const result = await db.query(
    `UPDATE shipments
     SET driver_id=$1, status='assigned', updated_at=NOW()
     WHERE id=$2
     RETURNING *`,
    [driverId, shipmentId]
  );
  return result.rows[0];
}

export async function updateShipmentStatus(id, status, userId = null) {
  // Get current status before updating
  const currentResult = await db.query(
    "SELECT status FROM shipments WHERE id=$1",
    [id]
  );
  const fromStatus = currentResult.rows[0]?.status;

  // Update the status
  const result = await db.query(
    "UPDATE shipments SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
    [status, id]
  );

  // Log the status change event
  if (result.rows[0] && fromStatus !== status) {
    const { logStatusChange } = await import('./shipmentEventsModel.js');
    await logStatusChange(id, fromStatus, status, userId);
  }

  // Get customer_id from order for push notifications
  if (result.rows[0]) {
    const orderResult = await db.query(
      "SELECT customer_id FROM orders WHERE id=$1",
      [result.rows[0].order_id]
    );
    if (orderResult.rows[0]) {
      result.rows[0].customer_id = orderResult.rows[0].customer_id;
    }
  }

  return result.rows[0];
}

/**
 * Generate a unique tracking number
 * Format: DM-YYYYMMDD-XXXXXX (DM = DropMate)
 */
function generateTrackingNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DM-${dateStr}-${random}`;
}

/**
 * Create a new shipment
 * @param {number} orderId - The order ID
 * @param {Object|string} pickupData - Pickup location data (legacy: string, new: object)
 * @param {Object|string} deliveryData - Delivery location data (legacy: string, new: object)
 * @param {number} [userId] - User ID who created the shipment
 * @param {Object} [additionalData] - Additional shipment data (sender, receiver, package)
 * @param {Object} [additionalData.sender] - Sender information
 * @param {string} [additionalData.sender.name] - Sender's full name
 * @param {string} [additionalData.sender.phone] - Sender's phone number
 * @param {Object} [additionalData.receiver] - Receiver information
 * @param {string} [additionalData.receiver.name] - Receiver's full name
 * @param {string} [additionalData.receiver.phone] - Receiver's phone number
 * @param {Object} [additionalData.package] - Package details
 * @param {number} [additionalData.package.weight] - Package weight in kg
 * @param {string} [additionalData.package.description] - Package description
 * @param {Object} [additionalData.package.details] - Additional package metadata
 * @param {string} [additionalData.package.status] - Package status (out_for_delivery, in_transit, delivered, exceptions)
 * @returns {Promise<Object>} The created shipment
 */
export async function createShipment(orderId, pickupData, deliveryData, userId = null, additionalData = {}) {
  const trackingNumber = generateTrackingNumber();

  // Support both old string format and new object format for backward compatibility
  const pickupAddress = typeof pickupData === 'string' ? pickupData : pickupData.address;
  const deliveryAddress = typeof deliveryData === 'string' ? deliveryData : deliveryData.address;
  const pickupLat = typeof pickupData === 'object' ? pickupData.latitude : null;
  const pickupLng = typeof pickupData === 'object' ? pickupData.longitude : null;
  const deliveryLat = typeof deliveryData === 'object' ? deliveryData.latitude : null;
  const deliveryLng = typeof deliveryData === 'object' ? deliveryData.longitude : null;

  // Extract additional data
  const senderName = additionalData.sender?.name || null;
  const senderPhone = additionalData.sender?.phone || null;
  const receiverName = additionalData.receiver?.name || null;
  const receiverPhone = additionalData.receiver?.phone || null;
  const packageWeight = additionalData.package?.weight || null;
  const packageDescription = additionalData.package?.description || null;
  const packageDetails = additionalData.package?.details || {};
  const packageStatus = additionalData.package?.status || null;

  const result = await db.query(
    `INSERT INTO shipments (
      order_id, tracking_number,
      pickup_address, delivery_address,
      pickup_latitude, pickup_longitude,
      delivery_latitude, delivery_longitude,
      sender_name, sender_phone,
      receiver_name, receiver_phone,
      package_weight, package_description, package_details,
      package_status,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pending')
    RETURNING *`,
    [
      orderId, trackingNumber,
      pickupAddress, deliveryAddress,
      pickupLat, pickupLng,
      deliveryLat, deliveryLng,
      senderName, senderPhone,
      receiverName, receiverPhone,
      packageWeight, packageDescription, packageDetails,
      packageStatus,
    ]
  );

  // Log shipment creation event
  if (result.rows[0]) {
    const { logShipmentCreated } = await import('./shipmentEventsModel.js');
    await logShipmentCreated(result.rows[0].id, userId, {
      pickup_address: pickupAddress,
      delivery_address: deliveryAddress,
      tracking_number: trackingNumber,
      sender: senderName ? { name: senderName, phone: senderPhone } : null,
      receiver: receiverName ? { name: receiverName, phone: receiverPhone } : null,
      package: packageWeight ? { weight: packageWeight, description: packageDescription } : null,
      coordinates: {
        pickup: pickupLat && pickupLng ? { lat: pickupLat, lng: pickupLng } : null,
        delivery: deliveryLat && deliveryLng ? { lat: deliveryLat, lng: deliveryLng } : null
      }
    });
  }

  return result.rows[0];
}

/**
 * Update the package status of a shipment
 * @param {number} id - Shipment ID
 * @param {string} packageStatus - Package status (out_for_delivery, in_transit, delivered, exceptions)
 * @param {number} [userId] - User ID who updated the status
 * @returns {Promise<Object>} Updated shipment
 */
export async function updatePackageStatus(id, packageStatus, userId = null) {
  // Validate package status
  const validStatuses = ['out_for_delivery', 'in_transit', 'delivered', 'exceptions'];
  if (packageStatus && !validStatuses.includes(packageStatus)) {
    throw new Error(`Invalid package status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Update the package status
  const result = await db.query(
    "UPDATE shipments SET package_status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
    [packageStatus, id]
  );

  // Log the package status change event (if logging function exists)
  if (result.rows[0]) {
    try {
      const { logPackageStatusChange } = await import('./shipmentEventsModel.js');
      if (logPackageStatusChange) {
        await logPackageStatusChange(id, packageStatus, userId);
      }
    } catch (err) {
      // Event logging is optional, don't fail the update if it's not available
      console.warn('Package status event logging not available:', err.message);
    }

    // Get customer_id from order for push notifications
    const orderResult = await db.query(
      "SELECT customer_id FROM orders WHERE id=$1",
      [result.rows[0].order_id]
    );
    if (orderResult.rows[0]) {
      result.rows[0].customer_id = orderResult.rows[0].customer_id;
    }
  }

  return result.rows[0];
}
