# Role-Based Access Control System

## Overview

The DropMate backend implements a role-based system where users can be either **Customers** or **Drivers**, each with specific capabilities and endpoints.

---

## User Roles

### 🛍️ Customer
**Description**: Users who create and track packages

**Capabilities**:
- Create new shipments/packages
- View their own shipments
- Track shipments with live location
- View order history
- View delivery statistics

**Database Structure**:
- `users.role = 'customer'`
- Has entry in `customers` table linked via `user_id`

---

### 🚗 Driver
**Description**: Users who claim and deliver packages

**Capabilities**:
- View available packages to claim
- Claim/take packages (auto-assigns to them)
- View their assigned deliveries
- Update delivery status (in_transit, delivered)
- Update their location

**Database Structure**:
- `users.role = 'driver'`
- Has entry in `drivers` table linked via `user_id`

---

## API Endpoints by Role

### 👤 Common Endpoints (All Authenticated Users)

```http
GET  /api/users/me            # Get profile (includes role info)
PATCH /api/users/me           # Update profile
GET  /api/users/me/stats      # Get statistics
```

---

### 🛍️ Customer-Only Endpoints

#### Create Package/Shipment
```http
POST /api/users/me/shipments
```

**Request:**
```json
{
  "pickupAddress": "123 Main St, San Francisco",
  "deliveryAddress": "456 Market St, San Francisco",
  "totalAmount": 29.99
}
```

**Response:**
```json
{
  "message": "Shipment created successfully",
  "shipment": {
    "id": 5,
    "tracking_number": "DM-20251116-A3X9F2",
    "status": "pending",
    "pickup_address": "123 Main St, San Francisco",
    "delivery_address": "456 Market St, San Francisco"
  }
}
```

**Error if Driver tries:**
```json
{
  "error": "Forbidden",
  "message": "This endpoint is only accessible to customers"
}
```

#### View My Orders
```http
GET /api/users/me/orders
```

#### View My Shipments
```http
GET /api/users/me/shipments
```

#### Track Specific Shipment
```http
GET /api/users/me/shipments/:id
```

---

### 🚗 Driver-Only Endpoints

#### 1. View Available Packages
```http
GET /api/users/me/available-packages?limit=50
```

**Description**: Shows packages that are pending and unassigned

**Response:**
```json
{
  "count": 3,
  "packages": [
    {
      "id": 5,
      "tracking_number": "DM-20251116-A3X9F2",
      "pickup_address": "123 Main St",
      "delivery_address": "456 Market St",
      "status": "pending",
      "created_at": "2025-11-16T21:00:00.000Z",
      "order_id": 10,
      "total_amount": "29.99",
      "customer_name": "Alice Johnson",
      "customer_phone": "555-0123"
    }
  ]
}
```

**Error if Customer tries:**
```json
{
  "error": "Forbidden",
  "message": "This endpoint is only accessible to drivers"
}
```

---

#### 2. Claim a Package
```http
POST /api/users/me/packages/:id/claim
```

**Description**: Driver claims an available package, which auto-assigns it to them

**Response (Success):**
```json
{
  "message": "Package claimed successfully",
  "package": {
    "id": 5,
    "order_id": 10,
    "driver_id": 1,
    "tracking_number": "DM-20251116-A3X9F2",
    "status": "assigned",
    "updated_at": "2025-11-16T21:30:00.000Z"
  }
}
```

**Error Responses:**

Package already claimed:
```json
{
  "error": "Package unavailable",
  "message": "Package already claimed by another driver"
}
```

Package not pending:
```json
{
  "error": "Package unavailable",
  "message": "Package cannot be claimed (status: in_transit)"
}
```

**WebSocket Event**: Emits `shipment_assigned` event

---

#### 3. View My Deliveries
```http
GET /api/users/me/deliveries
GET /api/users/me/deliveries?status=assigned
GET /api/users/me/deliveries?status=in_transit
```

**Description**: Shows all packages assigned to this driver

**Response:**
```json
{
  "driverId": 1,
  "count": 2,
  "deliveries": [
    {
      "id": 5,
      "tracking_number": "DM-20251116-A3X9F2",
      "pickup_address": "123 Main St",
      "delivery_address": "456 Market St",
      "status": "assigned",
      "created_at": "2025-11-16T21:00:00.000Z",
      "customer_name": "Alice Johnson",
      "customer_phone": "555-0123",
      "total_amount": "29.99"
    }
  ]
}
```

---

#### 4. Update Delivery Status
```http
PATCH /api/users/me/deliveries/:id/status
```

**Description**: Driver updates status of their own delivery

**Request:**
```json
{
  "status": "in_transit"
}
```

**Valid Status Values:**
- `in_transit` - Package is being delivered
- `delivered` - Package has been delivered

**Response:**
```json
{
  "message": "Delivery status updated",
  "delivery": {
    "id": 5,
    "tracking_number": "DM-20251116-A3X9F2",
    "status": "in_transit",
    "updated_at": "2025-11-16T21:35:00.000Z"
  }
}
```

**Error if updating someone else's delivery:**
```json
{
  "error": "Forbidden",
  "message": "This delivery is not assigned to you"
}
```

**WebSocket Event**: Emits `shipment_updated` event

---

## Complete Workflow Examples

### Customer Workflow: Create and Track Package

```bash
# 1. Customer creates a package
curl -X POST http://localhost:8080/api/users/me/shipments \
  -H "Authorization: Bearer <CUSTOMER_FIREBASE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupAddress": "123 Main St, San Francisco",
    "deliveryAddress": "456 Market St, San Francisco",
    "totalAmount": 29.99
  }'

# Response: { "shipment": { "id": 5, "tracking_number": "DM-20251116-A3X9F2" } }

# 2. Customer tracks their package
curl http://localhost:8080/api/users/me/shipments/5 \
  -H "Authorization: Bearer <CUSTOMER_FIREBASE_TOKEN>"

# 3. Customer views all their shipments
curl http://localhost:8080/api/users/me/shipments \
  -H "Authorization: Bearer <CUSTOMER_FIREBASE_TOKEN>"
```

---

### Driver Workflow: Claim and Deliver Package

```bash
# 1. Driver views available packages
curl http://localhost:8080/api/users/me/available-packages \
  -H "Authorization: Bearer <DRIVER_FIREBASE_TOKEN>"

# Response: { "count": 3, "packages": [...] }

# 2. Driver claims a package (ID 5)
curl -X POST http://localhost:8080/api/users/me/packages/5/claim \
  -H "Authorization: Bearer <DRIVER_FIREBASE_TOKEN>"

# Response: { "message": "Package claimed successfully" }

# 3. Driver views their deliveries
curl http://localhost:8080/api/users/me/deliveries \
  -H "Authorization: Bearer <DRIVER_FIREBASE_TOKEN>"

# 4. Driver starts delivery
curl -X PATCH http://localhost:8080/api/users/me/deliveries/5/status \
  -H "Authorization: Bearer <DRIVER_FIREBASE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_transit"}'

# 5. Driver updates location (via location service)
curl -X POST http://localhost:8081/api/location/1 \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 37.78688073,
    "longitude": -122.40744584,
    "accuracy": 10
  }'

# 6. Driver marks as delivered
curl -X PATCH http://localhost:8080/api/users/me/deliveries/5/status \
  -H "Authorization: Bearer <DRIVER_FIREBASE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status": "delivered"}'
```

---

## Package Status Flow

```
[Customer Creates] → pending
                      ↓
[Driver Claims]    → assigned
                      ↓
[Driver Starts]    → in_transit
                      ↓
[Driver Completes] → delivered
```

---

## Role Verification

### Middleware Functions

**Located in**: `services/core-api/src/middleware/auth.js`

#### `authenticateFirebase`
- Verifies Firebase ID token
- Attaches `req.user` with: `{ id, firebase_uid, email, role }`
- Required for all authenticated endpoints

#### `requireCustomer`
- Must be used after `authenticateFirebase`
- Ensures `req.user.role === 'customer'`
- Returns 403 if user is not a customer

#### `requireDriver`
- Must be used after `authenticateFirebase`
- Ensures `req.user.role === 'driver'`
- Returns 403 if user is not a driver

---

## Testing

### Get Test Tokens

```bash
# For customer (Alice)
FIREBASE_API_KEY=your_key node get-test-token.js alice

# For driver (driver1@test.com, user_id=1)
FIREBASE_API_KEY=your_key node get-test-token.js driver
```

### Test User Accounts

**Customer Accounts**:
- `alice@test.com` (Firebase UID: fHesazNSXHglErKtyp37OgNDbMw2)
- `bob@test.com` (Firebase UID: PybscNfIwyQ8irpDcBFqFYtoeiT2)

**Driver Accounts**:
- `driver1@test.com` (user_id: 1, driver_id: 1 or 2)

---

## Security Features

### Role-Based Access Control
✅ Customers cannot access driver endpoints
✅ Drivers cannot access customer endpoints
✅ Drivers can only update their own deliveries
✅ Customers can only view their own shipments

### Package Claiming Protection
✅ Prevents double-claiming (race condition handling)
✅ Only pending packages can be claimed
✅ Claims are atomic (database transaction)

### Status Update Validation
✅ Drivers can only update to valid statuses
✅ Ownership verification before status update
✅ Real-time WebSocket notifications

---

## Database Schema

### Users Table
```sql
users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  role VARCHAR(50) DEFAULT 'customer',  -- 'customer' or 'driver'
  firebase_uid VARCHAR(255) UNIQUE
)
```

### Customers Table
```sql
customers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255),
  phone VARCHAR(50)
)
```

### Drivers Table
```sql
drivers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(255),
  vehicle_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'offline'
)
```

### Shipments Table
```sql
shipments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  driver_id INTEGER REFERENCES drivers(id),  -- NULL until claimed
  status VARCHAR(50) DEFAULT 'pending',
  tracking_number VARCHAR(100) UNIQUE
)
```

---

## Error Handling

### Common Error Codes

| Code | Scenario |
|------|----------|
| 401 | Missing or invalid Firebase token |
| 403 | Role mismatch (customer accessing driver endpoint) |
| 404 | Resource not found (package, profile) |
| 409 | Conflict (package already claimed) |
| 500 | Internal server error |

---

## Future Enhancements

Potential additions to the role-based system:

1. **Admin Role**: Manage users, view analytics, assign packages manually
2. **Driver Preferences**: Location-based package filtering, route optimization
3. **Rating System**: Customers rate drivers, drivers rate customers
4. **Multiple Roles**: Users can be both customer and driver
5. **Team Management**: Fleet managers coordinating multiple drivers
6. **Commission Tracking**: Driver earnings per delivery

---

## Notes

- Role is determined at user account creation
- Role cannot be changed through API (must be done via database)
- All authenticated endpoints verify Firebase token first
- Role-specific middleware runs after authentication
- WebSocket events notify all clients in real-time
