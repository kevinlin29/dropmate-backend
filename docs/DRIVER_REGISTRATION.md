# Driver Registration Guide

## Overview

Any authenticated user can register as a driver. This guide explains how to convert a customer account to a driver account or register as a driver from the start.

---

## Registration Flow

### Current User State → Driver

```
User Logs In (Firebase Auth)
        ↓
Auto-created as Customer (default)
        ↓
POST /api/users/me/register-driver
        ↓
User role updated to "driver"
Driver profile created
        ↓
Can now access driver endpoints
```

---

## API Endpoint

### Register as Driver

```http
POST /api/users/me/register-driver
```

**Authentication**: 🔒 Required (Firebase token)

**Description**: Converts current user to a driver by creating a driver profile

**Request Body**:
```json
{
  "name": "John Driver",
  "vehicleType": "Van",
  "licenseNumber": "DL12345678"
}
```

**Response (201 Created)**:
```json
{
  "message": "Driver profile created successfully",
  "driver": {
    "id": 3,
    "user_id": 5,
    "name": "John Driver",
    "vehicle_type": "Van",
    "license_number": "DL12345678",
    "status": "offline",
    "created_at": "2025-11-16T22:00:00.000Z",
    "updated_at": "2025-11-16T22:00:00.000Z"
  }
}
```

**What Happens**:
1. ✅ User's role is updated from `customer` to `driver`
2. ✅ Driver profile is created in `drivers` table
3. ✅ Driver status is set to `offline` (ready to go online)
4. ✅ User can now access all driver endpoints

**Errors**:

Already registered:
```json
{
  "error": "Conflict",
  "message": "You already have a driver profile"
}
```

Missing fields:
```json
{
  "error": "Bad request",
  "message": "name, vehicleType, and licenseNumber are required"
}
```

---

## Update Driver Profile

### Update Driver Information

```http
PATCH /api/users/me/driver-profile
```

**Authentication**: 🚗 Driver Only

**Description**: Update driver profile details

**Request Body** (all fields optional):
```json
{
  "name": "John Smith Driver",
  "vehicleType": "Truck",
  "licenseNumber": "DL98765432"
}
```

**Response**:
```json
{
  "message": "Driver profile updated",
  "driver": {
    "id": 3,
    "user_id": 5,
    "name": "John Smith Driver",
    "vehicle_type": "Truck",
    "license_number": "DL98765432",
    "status": "offline",
    "updated_at": "2025-11-16T22:05:00.000Z"
  }
}
```

**Errors**:

Not a driver:
```json
{
  "error": "Forbidden",
  "message": "This endpoint is only accessible to drivers"
}
```

No fields provided:
```json
{
  "error": "Bad request",
  "message": "At least one field (name, vehicleType, licenseNumber) must be provided"
}
```

---

## Complete Registration Example

### Step 1: User Signs Up (Firebase)

```javascript
// Frontend: Create Firebase account
const userCredential = await createUserWithEmailAndPassword(
  auth,
  'newdriver@example.com',
  'password123'
);

const idToken = await userCredential.user.getIdToken();
```

### Step 2: User Auto-Created as Customer

When the user makes their first authenticated API call, they're automatically created as a customer:

```javascript
// First API call with Firebase token
const response = await fetch('http://localhost:8080/api/users/me', {
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
});

// User created with role: 'customer'
```

### Step 3: Register as Driver

```bash
curl -X POST http://localhost:8080/api/users/me/register-driver \
  -H "Authorization: Bearer <FIREBASE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Driver",
    "vehicleType": "Van",
    "licenseNumber": "DL12345678"
  }'
```

**Response**:
```json
{
  "message": "Driver profile created successfully",
  "driver": {
    "id": 3,
    "user_id": 5,
    "name": "John Driver",
    "vehicle_type": "Van",
    "license_number": "DL12345678",
    "status": "offline"
  }
}
```

### Step 4: Access Driver Endpoints

Now the user can access all driver endpoints:

```bash
# View available packages
curl http://localhost:8080/api/users/me/available-packages \
  -H "Authorization: Bearer <FIREBASE_TOKEN>"

# Claim a package
curl -X POST http://localhost:8080/api/users/me/packages/5/claim \
  -H "Authorization: Bearer <FIREBASE_TOKEN>"

# View my deliveries
curl http://localhost:8080/api/users/me/deliveries \
  -H "Authorization: Bearer <FIREBASE_TOKEN>"
```

---

## Vehicle Types

Common vehicle types (customize as needed):
- `Car` - Standard sedan or hatchback
- `Van` - Cargo or passenger van
- `Truck` - Pickup truck or box truck
- `Motorcycle` - Scooter or motorcycle
- `Bicycle` - Bicycle courier
- `SUV` - Sport utility vehicle

---

## Frontend Integration

### React/TypeScript Example

```typescript
// Driver registration form
const registerAsDriver = async (formData: {
  name: string;
  vehicleType: string;
  licenseNumber: string;
}) => {
  const token = await auth.currentUser?.getIdToken();

  const response = await fetch('/api/users/me/register-driver', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  });

  if (response.status === 409) {
    // Already registered as driver
    throw new Error('You are already registered as a driver');
  }

  if (!response.ok) {
    throw new Error('Failed to register as driver');
  }

  const data = await response.json();

  // Redirect to driver dashboard
  window.location.href = '/driver/dashboard';

  return data.driver;
};

// Update driver profile
const updateDriverProfile = async (updates: {
  name?: string;
  vehicleType?: string;
  licenseNumber?: string;
}) => {
  const token = await auth.currentUser?.getIdToken();

  const response = await fetch('/api/users/me/driver-profile', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    throw new Error('Failed to update driver profile');
  }

  return await response.json();
};
```

---

## Database Changes

### Before Registration

```sql
-- User table
users
  id: 5
  email: 'newdriver@example.com'
  role: 'customer'  ← Default

-- Customer table
customers
  id: 8
  user_id: 5
  name: 'newdriver'
```

### After Registration

```sql
-- User table
users
  id: 5
  email: 'newdriver@example.com'
  role: 'driver'  ← Updated

-- Customer table (unchanged)
customers
  id: 8
  user_id: 5
  name: 'newdriver'

-- Driver table (new record)
drivers
  id: 3
  user_id: 5  ← Links to user
  name: 'John Driver'
  vehicle_type: 'Van'
  license_number: 'DL12345678'
  status: 'offline'
```

---

## Security Considerations

### ✅ Implemented

- **Authentication Required**: Must have valid Firebase token
- **Duplicate Prevention**: Cannot register twice as driver
- **Role Update**: Automatic role change from customer to driver
- **Data Validation**: Required fields are validated
- **Update Protection**: Only drivers can update their profile

### 🔒 Additional Recommendations

Consider adding for production:

1. **License Verification**: Verify license number with DMV/transport authority
2. **Background Check**: Driver screening process
3. **Document Upload**: Upload license photo, insurance, vehicle registration
4. **Approval Workflow**: Admin approval before driver can accept packages
5. **Vehicle Verification**: Verify vehicle ownership
6. **Insurance Validation**: Require proof of insurance

---

## FAQ

### Can a user be both customer and driver?

**Current implementation**: No. When you register as a driver, your role changes from `customer` to `driver`.

**Future enhancement**: Support multiple roles by changing `role` from VARCHAR to an array or junction table.

### Can I switch back to customer?

**Current implementation**: No API endpoint exists. Would need database update to change `role` back to `customer`.

**Recommendation**: Support role switching via admin panel.

### What happens to customer data when I become a driver?

Your customer profile and order history remain intact. You'll still have access to view your own orders as a customer, but primary functionality switches to driver features.

### Can I update my vehicle type later?

Yes! Use `PATCH /api/users/me/driver-profile` to update any driver information.

---

## Testing

### Test Registration

```bash
# 1. Create Firebase user (use Firebase console or SDK)

# 2. Get Firebase token
FIREBASE_API_KEY=your_key node get-test-token.js

# 3. Register as driver
curl -X POST http://localhost:8080/api/users/me/register-driver \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Driver",
    "vehicleType": "Car",
    "licenseNumber": "TEST123"
  }'

# 4. Verify driver can access driver endpoints
curl http://localhost:8080/api/users/me/available-packages \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Summary

### New Endpoints Added

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/users/me/register-driver` | 🔒 Auth | Register as driver |
| PATCH | `/api/users/me/driver-profile` | 🚗 Driver | Update driver profile |

### Key Features

✅ Self-service driver registration
✅ Automatic role conversion
✅ Profile update capability
✅ Duplicate prevention
✅ Input validation
✅ Clear error messages

---

**Now users can register as drivers through the API!** 🚗
