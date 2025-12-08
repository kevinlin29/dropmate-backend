# Shipment History & Event Tracking System

## Overview

The DropMate backend now includes a comprehensive shipment history tracking system that automatically logs all important events in a package's lifecycle and provides both customer-facing and admin-facing APIs to view this history.

## Features

✅ **Automatic Event Logging** - All status changes, driver assignments, and key events are automatically tracked
✅ **Manual Event Creation** - Drivers can add custom events, notes, and updates
✅ **Customer-Friendly History** - Filtered timeline view for end customers
✅ **Admin Full History** - Complete event log with all metadata for debugging
✅ **Real-time WebSocket Events** - Events are broadcast in real-time
✅ **Partitioned Database** - Optimized for high-volume event storage

---

## Database Schema

### Enhanced `shipment_events` Table

```sql
shipment_events (
  id                   BIGINT PRIMARY KEY,
  shipment_id          INTEGER NOT NULL,
  event_type           VARCHAR(50) NOT NULL,
  description          TEXT,
  latitude             NUMERIC(10,8),
  longitude            NUMERIC(11,8),
  occurred_at          TIMESTAMP NOT NULL,
  created_by_user_id   INTEGER,              -- Who triggered this event
  from_status          VARCHAR(50),          -- Previous status
  to_status            VARCHAR(50),          -- New status
  metadata             JSONB                 -- Additional contextual data
)
```

**Partitioning**: Time-based partitioning by `occurred_at` for performance

---

## Event Types

### Automatically Logged Events

| Event Type | Triggered When | Visible to Customer |
|---|---|---|
| `shipment_created` | Package is created | ✅ Yes |
| `driver_allocated` | Driver claims package | ✅ Yes |
| `out_for_delivery` | Status changed to in_transit | ✅ Yes |
| `delivered` | Package marked as delivered | ✅ Yes |
| `status_changed` | Any other status change | ✅ Yes |

### Manual Events (Driver-Added)

| Event Type | Usage |
|---|---|
| `arrived_at_pickup` | Driver arrives at pickup location |
| `package_picked_up` | Package collected from sender |
| `arrived_at_destination` | Driver arrives at delivery address |
| `delivery_attempted` | Delivery attempt failed |
| `note_added` | General note/update |
| `issue_reported` | Problem or delay reported |
| `package_delayed` | Package delayed |

### Internal Events (Not Shown to Customers)

| Event Type | Usage |
|---|---|
| `location_updated` | High-frequency GPS updates |

---

## API Endpoints

### 1. Customer View Shipment History

**Endpoint:** `GET /api/users/me/shipments/:id/history`
**Authentication:** Required (Customer must own the shipment)
**Description:** Get customer-friendly event timeline

**Response:**
```json
{
  "shipmentId": 20,
  "count": 3,
  "events": [
    {
      "event_type": "shipment_created",
      "description": "Package created and awaiting driver",
      "occurred_at": "2025-11-17T02:44:59.600Z",
      "to_status": "pending",
      "driver_name": null
    },
    {
      "event_type": "driver_allocated",
      "description": "Driver accepted delivery request",
      "occurred_at": "2025-11-17T03:15:22.100Z",
      "to_status": "assigned",
      "driver_name": "Test test"
    },
    {
      "event_type": "out_for_delivery",
      "description": "Package is out for delivery",
      "occurred_at": "2025-11-17T03:30:45.200Z",
      "to_status": "in_transit",
      "driver_name": "Test test"
    }
  ]
}
```

---

### 2. Admin View Full Event History

**Endpoint:** `GET /api/shipments/:id/events?limit=100&includeLocationUpdates=false`
**Authentication:** Optional
**Description:** Get complete event log with all metadata

**Query Parameters:**
- `limit` (number, default: 100) - Max events to return
- `includeLocationUpdates` (boolean, default: false) - Include high-frequency location events

**Response:**
```json
{
  "shipmentId": 20,
  "count": 2,
  "events": [
    {
      "id": "2",
      "shipment_id": 20,
      "event_type": "delivered",
      "description": "Package delivered successfully",
      "latitude": null,
      "longitude": null,
      "occurred_at": "2025-11-17T04:42:43.710Z",
      "created_by_user_id": null,
      "from_status": "in_transit",
      "to_status": "delivered",
      "metadata": {},
      "created_by_email": null,
      "created_by_name": null
    },
    {
      "id": "1",
      "shipment_id": 20,
      "event_type": "out_for_delivery",
      "description": "Package is out for delivery",
      "occurred_at": "2025-11-17T04:42:11.631Z",
      "created_by_user_id": null,
      "from_status": "assigned",
      "to_status": "in_transit",
      "metadata": {}
    }
  ]
}
```

---

### 3. Driver Add Manual Event

**Endpoint:** `POST /api/users/me/deliveries/:id/events`
**Authentication:** Required (Driver only, must be assigned to shipment)
**Description:** Add a custom event, note, or update to a delivery

**Request Body:**
```json
{
  "eventType": "arrived_at_pickup",
  "description": "Arrived at pickup location - 123 Main St",
  "latitude": 37.7749,
  "longitude": -122.4194
}
```

**Available Event Types:**
- `arrived_at_pickup`
- `package_picked_up`
- `arrived_at_destination`
- `delivery_attempted`
- `note_added`
- `issue_reported`
- `package_delayed`

**Response:**
```json
{
  "message": "Event logged successfully",
  "event": {
    "id": "3",
    "shipment_id": 20,
    "event_type": "arrived_at_pickup",
    "description": "Arrived at pickup location - 123 Main St",
    "occurred_at": "2025-11-17T05:00:00.000Z"
  }
}
```

---

## Code Integration

### Automatic Event Logging

Events are automatically logged when:

**1. Package is Created**
```javascript
// userModel.js - createUserShipment()
const shipment = await createShipment(order.id, pickupAddress, deliveryAddress, userId);
// → Logs: shipment_created event
```

**2. Driver Claims Package**
```javascript
// driverModel.js - claimPackage()
const claimedPackage = await claimPackage(shipmentId, driverId, userId);
// → Logs: driver_allocated event
```

**3. Status Changes**
```javascript
// shipmentsModel.js - updateShipmentStatus()
const updated = await updateShipmentStatus(shipmentId, 'in_transit', userId);
// → Logs: out_for_delivery event (or other status-specific event)
```

### Manual Event Logging

```javascript
import { logShipmentEvent, EVENT_TYPES } from './models/shipmentEventsModel.js';

// Log custom event
await logShipmentEvent({
  shipmentId: 20,
  eventType: EVENT_TYPES.ARRIVED_AT_PICKUP,
  description: 'Driver arrived at pickup location',
  userId: driverUserId,
  latitude: 37.7749,
  longitude: -122.4194,
  metadata: {
    arrivalTime: new Date().toISOString(),
    parkingSpot: 'A-12'
  }
});
```

### Convenience Functions

```javascript
import {
  logShipmentCreated,
  logDriverAssigned,
  logStatusChange,
  logPackagePickedUp,
  logArrivedAtDestination,
  logDeliveryAttempted,
  logDelivered,
  logNote,
  logIssue
} from './models/shipmentEventsModel.js';

// Log package picked up
await logPackagePickedUp(shipmentId, userId, latitude, longitude);

// Log delivery attempt (failed)
await logDeliveryAttempted(shipmentId, userId, 'Customer not home');

// Log successful delivery
await logDelivered(shipmentId, userId, latitude, longitude, {
  signedBy: 'John Doe',
  photoUrl: 'https://...'
});

// Log driver note
await logNote(shipmentId, userId, 'Customer requested to leave at side door');

// Log issue
await logIssue(shipmentId, userId, 'Traffic delay - 20 minutes late', {
  estimatedDelay: 20
});
```

---

## WebSocket Integration

When events are created, they are broadcast in real-time:

```javascript
// Emitted automatically on manual event creation
io.emit('shipment_event', {
  shipmentId: 20,
  event: {
    type: 'arrived_at_pickup',
    description: 'Driver arrived at pickup location',
    occurred_at: '2025-11-17T05:00:00.000Z'
  }
});
```

**Frontend Example:**
```javascript
socket.on('shipment_event', (data) => {
  console.log(`New event for shipment ${data.shipmentId}:`, data.event);
  // Update UI to show new event
});
```

---

## Usage Examples

### Customer Tracking Their Package

```bash
# Get shipment history
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/users/me/shipments/20/history
```

### Driver Adding Event During Delivery

```bash
# Driver arrives at pickup location
curl -X POST \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "arrived_at_pickup",
    "description": "Arrived at 123 Main St",
    "latitude": 37.7749,
    "longitude": -122.4194
  }' \
  http://localhost:8080/api/users/me/deliveries/20/events

# Driver picks up package
curl -X POST \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "package_picked_up",
    "description": "Package collected from sender",
    "latitude": 37.7749,
    "longitude": -122.4194
  }' \
  http://localhost:8080/api/users/me/deliveries/20/events

# Driver arrives at delivery address
curl -X POST \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "arrived_at_destination",
    "description": "Arrived at 456 Market St",
    "latitude": 37.7849,
    "longitude": -122.4094
  }' \
  http://localhost:8080/api/users/me/deliveries/20/events

# Update status to delivered
curl -X PATCH \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "delivered"}' \
  http://localhost:8080/api/users/me/deliveries/20/status
```

### Admin Viewing Full Event Log

```bash
# Get all events for shipment
curl http://localhost:8080/api/shipments/20/events

# Get events with location updates
curl "http://localhost:8080/api/shipments/20/events?includeLocationUpdates=true"

# Limit to last 10 events
curl "http://localhost:8080/api/shipments/20/events?limit=10"
```

---

## Database Maintenance

### Cleanup Old Location Events

Location update events can accumulate quickly. Use the cleanup function:

```javascript
import { cleanupOldLocationEvents } from './models/shipmentEventsModel.js';

// Delete location events older than 30 days
const deletedCount = await cleanupOldLocationEvents(30);
console.log(`Deleted ${deletedCount} old location events`);
```

**Recommended Schedule:** Run monthly as a cron job

---

## Performance Considerations

1. **Partitioning:** The `shipment_events` table is partitioned by `occurred_at` for efficient querying
2. **Indexes:** Optimized indexes on `(shipment_id, occurred_at)`, `event_type`, and `created_by_user_id`
3. **Location Events:** High-frequency location updates are excluded from customer views by default
4. **Query Limits:** Default limit of 100 events per query to prevent large result sets

---

## Testing

### Verified Scenarios

✅ Package creation logs `shipment_created` event
✅ Driver claiming package logs `driver_allocated` event
✅ Status change to in_transit logs `out_for_delivery` event
✅ Status change to delivered logs `delivered` event
✅ Events are queryable via API
✅ Customer history endpoint filters internal events
✅ Manual event creation works for drivers

### Test Results

```
Event #1: out_for_delivery (from_status: assigned → to_status: in_transit)
Event #2: delivered (from_status: in_transit → to_status: delivered)

✅ All tests passing
```

---

## Future Enhancements

- [ ] Add photo upload support for delivery proof
- [ ] Add customer signature capture for deliveries
- [ ] Add SMS/Email notifications triggered by events
- [ ] Add event templates for common scenarios
- [ ] Add analytics dashboard for event patterns
- [ ] Add event-based automated workflows

---

## Summary

The shipment history system provides:
- **Transparency** for customers to track their packages
- **Accountability** with complete audit trail
- **Flexibility** for drivers to add custom updates
- **Scalability** with partitioned tables and optimized queries
- **Real-time updates** via WebSocket integration

All key events are automatically tracked, while drivers have the ability to add manual updates for exceptional situations.
