import db from "./db.js";

/** List all active drivers with their last known location */
export async function listDrivers() {
  const query = `
    SELECT d.id,
           d.name,
           d.vehicle_type,
           d.license_number,
           d.status,
           COALESCE(
             (SELECT json_build_object(
                 'latitude', dle.latitude,
                 'longitude', dle.longitude,
                 'recorded_at', dle.occurred_at
              )
              FROM driver_location_events dle
              WHERE dle.driver_id = d.id
              ORDER BY dle.occurred_at DESC
              LIMIT 1),
           '{}'::json) AS last_location
      FROM drivers d
     ORDER BY d.name;
  `;
  const { rows } = await db.query(query);
  return rows;
}

/** Update driver status (e.g. active, on_duty, offline) */
export async function updateDriverStatus(id, status) {
  const { rows } = await db.query(
    `UPDATE drivers
        SET status=$1, updated_at=NOW()
      WHERE id=$2
  RETURNING *;`,
    [status, id]
  );
  return rows[0];
}

/** Insert a live location event for a driver */
export async function addDriverLocationEvent(driverId, latitude, longitude) {
  const { rows } = await db.query(
    `INSERT INTO driver_location_events (driver_id, latitude, longitude)
         VALUES ($1, $2, $3)
      RETURNING *;`,
    [driverId, latitude, longitude]
  );
  return rows[0];
}

/**
 * Get driver ID from user ID
 * @param {number} userId - User ID
 * @returns {Promise<number|null>} Driver ID or null
 */
export async function getDriverIdByUserId(userId) {
  const result = await db.query(
    'SELECT id FROM drivers WHERE user_id = $1',
    [userId]
  );
  return result.rows[0]?.id || null;
}

/**
 * Create a driver profile for an existing user
 * @param {number} userId - User ID
 * @param {Object} driverData - Driver information
 * @param {string} driverData.name - Driver's name
 * @param {string} driverData.vehicleType - Vehicle type (e.g., 'Car', 'Van', 'Motorcycle')
 * @param {string} driverData.licenseNumber - Driver's license number
 * @returns {Promise<Object>} Created driver profile
 */
export async function createDriverProfile(userId, { name, vehicleType, licenseNumber }) {
  // Check if user already has a driver profile
  const existingDriver = await db.query(
    'SELECT id FROM drivers WHERE user_id = $1',
    [userId]
  );

  if (existingDriver.rows.length > 0) {
    throw new Error('User already has a driver profile');
  }

  // Check if user exists and get their current role
  const userResult = await db.query(
    'SELECT id, role FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  // Update user role to driver
  await db.query(
    'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
    ['driver', userId]
  );

  // Create driver profile
  const result = await db.query(
    `INSERT INTO drivers (user_id, name, vehicle_type, license_number, status)
     VALUES ($1, $2, $3, $4, 'offline')
     RETURNING *`,
    [userId, name, vehicleType, licenseNumber]
  );

  return result.rows[0];
}

/**
 * Update driver profile
 * @param {number} driverId - Driver ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated driver profile
 */
export async function updateDriverProfile(driverId, updates) {
  const { name, vehicleType, licenseNumber } = updates;

  const result = await db.query(
    `UPDATE drivers
     SET name = COALESCE($1, name),
         vehicle_type = COALESCE($2, vehicle_type),
         license_number = COALESCE($3, license_number),
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [name, vehicleType, licenseNumber, driverId]
  );

  if (result.rows.length === 0) {
    throw new Error('Driver not found');
  }

  return result.rows[0];
}

/**
 * Get available packages for drivers to claim
 * Packages must be pending and have no driver assigned
 * @param {number} limit - Max number of packages to return
 * @returns {Promise<Array>} Available packages
 */
export async function getAvailablePackages(limit = 50) {
  const result = await db.query(
    `SELECT s.id,
            s.tracking_number,
            s.pickup_address,
            s.delivery_address,
            s.pickup_latitude,
            s.pickup_longitude,
            s.delivery_latitude,
            s.delivery_longitude,
            s.sender_name,
            s.sender_phone,
            s.receiver_name,
            s.receiver_phone,
            s.package_weight,
            s.package_description,
            s.package_details,
            s.status,
            s.package_status,
            s.created_at,
            o.id as order_id,
            o.total_amount,
            c.name as customer_name,
            c.phone as customer_phone
     FROM shipments s
     JOIN orders o ON o.id = s.order_id
     JOIN customers c ON c.id = o.customer_id
     WHERE s.status = 'pending'
       AND s.driver_id IS NULL
       AND s.deleted_at IS NULL
     ORDER BY s.created_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Claim a package (assign it to a driver)
 * @param {number} shipmentId - Shipment ID
 * @param {number} driverId - Driver ID
 * @returns {Promise<Object>} Updated shipment
 */
export async function claimPackage(shipmentId, driverId, userId = null) {
  // Check if package is still available
  const checkResult = await db.query(
    'SELECT id, driver_id, status FROM shipments WHERE id = $1',
    [shipmentId]
  );

  if (checkResult.rows.length === 0) {
    throw new Error('Package not found');
  }

  const shipment = checkResult.rows[0];

  if (shipment.driver_id) {
    throw new Error('Package already claimed by another driver');
  }

  if (shipment.status !== 'pending') {
    throw new Error(`Package cannot be claimed (status: ${shipment.status})`);
  }

  // Assign driver and update status
  const result = await db.query(
    `UPDATE shipments
     SET driver_id = $1,
         status = 'assigned',
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [driverId, shipmentId]
  );

  // Log driver allocation event
  if (result.rows[0]) {
    const { logDriverAssigned } = await import('./shipmentEventsModel.js');
    await logDriverAssigned(shipmentId, driverId, userId, {
      assigned_at: new Date().toISOString()
    });

    // Get customer_id from order for push notifications
    if (result.rows[0].order_id) {
      const orderResult = await db.query(
        'SELECT customer_id FROM orders WHERE id = $1',
        [result.rows[0].order_id]
      );
      if (orderResult.rows[0]) {
        result.rows[0].customer_id = orderResult.rows[0].customer_id;
      }
    }
  }

  return result.rows[0];
}

/**
 * Get all deliveries (packages) assigned to a driver
 * @param {number} driverId - Driver ID
 * @param {string} statusFilter - Optional status filter (e.g., 'assigned', 'in_transit')
 * @returns {Promise<Array>} Driver's packages
 */
export async function getDriverDeliveries(driverId, statusFilter = null) {
  let query = `
    SELECT s.id,
           s.tracking_number,
           s.pickup_address,
           s.delivery_address,
           s.pickup_latitude,
           s.pickup_longitude,
           s.delivery_latitude,
           s.delivery_longitude,
           s.sender_name,
           s.sender_phone,
           s.receiver_name,
           s.receiver_phone,
           s.package_weight,
           s.package_description,
           s.package_details,
           s.status,
           s.package_status,
           s.created_at,
           s.updated_at,
           o.id as order_id,
           o.total_amount,
           c.name as customer_name,
           c.phone as customer_phone
    FROM shipments s
    JOIN orders o ON o.id = s.order_id
    JOIN customers c ON c.id = o.customer_id
    WHERE s.driver_id = $1
      AND s.deleted_at IS NULL
  `;

  const params = [driverId];

  if (statusFilter) {
    query += ` AND s.status = $2`;
    params.push(statusFilter);
  }

  query += ` ORDER BY s.created_at DESC`;

  const result = await db.query(query, params);
  return result.rows;
}
