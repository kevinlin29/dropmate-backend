# React Firebase Integration Guide
## For Project: dropmate-9dc10

## 1. Install Firebase in Your React App

```bash
npm install firebase
```

## 2. Create Firebase Configuration File

Create `src/firebase/config.js` in your React app:

```javascript
// src/firebase/config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDhVe6Q8aJyK0vAWMJsrPIECw7hQZiVD5o",
  authDomain: "dropmate-9dc10.firebaseapp.com",
  projectId: "dropmate-9dc10",
  storageBucket: "dropmate-9dc10.firebasestorage.app",
  messagingSenderId: "765867938215",
  appId: "1:765867938215:web:f63457ca27261641a6e682",
  measurementId: "G-4ELJ8G7W46"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export default app;
```

## 3. Create Authentication Hook

Create `src/hooks/useAuth.js`:

```javascript
// src/hooks/useAuth.js
import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '../firebase/config';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        setUser(firebaseUser);
        setToken(idToken);
        localStorage.setItem('authToken', idToken);
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    setToken(idToken);
    localStorage.setItem('authToken', idToken);
    return userCredential.user;
  };

  const signUp = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    setToken(idToken);
    localStorage.setItem('authToken', idToken);
    return userCredential.user;
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    setToken(idToken);
    localStorage.setItem('authToken', idToken);
    return result.user;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setToken(null);
    localStorage.removeItem('authToken');
  };

  return {
    user,
    token,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut
  };
}
```

## 4. Create API Service

Create `src/services/api.js`:

```javascript
// src/services/api.js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem('authToken');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired - redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

// User API
export const userApi = {
  getProfile: () => fetchWithAuth('/api/users/me'),

  updateProfile: (data) => fetchWithAuth('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  getStats: () => fetchWithAuth('/api/users/me/stats'),

  getOrders: () => fetchWithAuth('/api/users/me/orders'),

  getShipments: () => fetchWithAuth('/api/users/me/shipments'),

  getShipment: (id) => fetchWithAuth(`/api/users/me/shipments/${id}`),
};

// Public API (no auth required)
export const publicApi = {
  trackShipment: (trackingNumber) =>
    fetch(`${API_URL}/api/shipments/track/${trackingNumber}`)
      .then(res => res.json()),
};
```

## 5. Login Component Example

Create `src/components/Login.jsx`:

```javascript
// src/components/Login.jsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <h2>Login to DropMate</h2>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <button onClick={handleGoogleSignIn} className="google-btn">
        Sign in with Google
      </button>
    </div>
  );
}
```

## 6. Dashboard Component Example

Create `src/components/Dashboard.jsx`:

```javascript
// src/components/Dashboard.jsx
import { useEffect, useState } from 'react';
import { userApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [shipmentsData, statsData] = await Promise.all([
        userApi.getShipments(),
        userApi.getStats()
      ]);

      setShipments(shipmentsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <header>
        <h1>Welcome, {user.email}</h1>
        <button onClick={signOut}>Logout</button>
      </header>

      <div className="stats">
        <div className="stat-card">
          <h3>Total Orders</h3>
          <p>{stats?.total_orders || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Active Shipments</h3>
          <p>{stats?.in_transit_shipments || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Delivered</h3>
          <p>{stats?.delivered_shipments || 0}</p>
        </div>
      </div>

      <div className="shipments">
        <h2>My Packages</h2>
        {shipments.map((shipment) => (
          <div key={shipment.id} className="shipment-card">
            <h3>{shipment.tracking_number}</h3>
            <p>Status: {shipment.status}</p>
            {shipment.driver_name && (
              <p>Driver: {shipment.driver_name}</p>
            )}
            {shipment.current_location && (
              <p>
                Last seen: {shipment.current_location.latitude},
                {shipment.current_location.longitude}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 7. Live Tracking Component

Create `src/components/LiveTracking.jsx`:

```javascript
// src/components/LiveTracking.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import { userApi } from '../services/api';

export function LiveTracking() {
  const { shipmentId } = useParams();
  const [shipment, setShipment] = useState(null);
  const [location, setLocation] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    loadShipment();
    connectWebSocket();

    return () => {
      if (socket) socket.disconnect();
    };
  }, [shipmentId]);

  const loadShipment = async () => {
    try {
      const data = await userApi.getShipment(shipmentId);
      setShipment(data);
      setLocation(data.current_location);
    } catch (error) {
      console.error('Failed to load shipment:', error);
    }
  };

  const connectWebSocket = () => {
    const ws = io('http://localhost:8082');

    ws.on('connected', () => {
      console.log('Connected to notification service');
      ws.emit('subscribe:shipment', shipmentId);
    });

    ws.on('shipment_location_updated', (data) => {
      console.log('Location update:', data);
      setLocation({
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp
      });
    });

    setSocket(ws);
  };

  if (!shipment) return <div>Loading...</div>;

  return (
    <div className="live-tracking">
      <h1>Track Package: {shipment.tracking_number}</h1>
      <p>Status: {shipment.status}</p>

      {shipment.driver_name && (
        <div className="driver-info">
          <h3>Driver: {shipment.driver_name}</h3>
          <p>Vehicle: {shipment.vehicle_type}</p>
        </div>
      )}

      {location && (
        <div className="location">
          <h3>Current Location</h3>
          <p>Lat: {location.latitude}</p>
          <p>Lng: {location.longitude}</p>
          <p>Last update: {new Date(location.timestamp).toLocaleString()}</p>

          {/* Add Google Maps here */}
          <div id="map" style={{ height: '400px', width: '100%' }}>
            {/* Use Google Maps API or Mapbox to show marker */}
          </div>
        </div>
      )}
    </div>
  );
}
```

## 8. Environment Variables

Create `.env.local` in your React app:

```env
REACT_APP_API_URL=http://localhost:8080
REACT_APP_WS_URL=http://localhost:8082
```

## 9. App Router Setup

Update your `src/App.js`:

```javascript
// src/App.js
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { LiveTracking } from './components/LiveTracking';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/track/:shipmentId"
          element={
            <PrivateRoute>
              <LiveTracking />
            </PrivateRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

## 10. Test It!

1. **Start your React app:**
```bash
npm start
```

2. **Create an account:**
- Go to http://localhost:3000/login
- Sign up with email/password

3. **You should see:**
- User automatically created in backend
- Dashboard shows "My Packages" (empty at first)
- Can view profile

4. **Test with existing data:**
- Backend will link your Firebase user to existing test data
- You'll see shipments with live tracking

## API Endpoints Available

All require `Authorization: Bearer <firebase-token>` header:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/me` | GET | User profile |
| `/api/users/me` | PATCH | Update profile |
| `/api/users/me/stats` | GET | Statistics |
| `/api/users/me/orders` | GET | User's orders |
| `/api/users/me/shipments` | GET | User's packages |
| `/api/users/me/shipments/:id` | GET | Specific package + location |

## WebSocket Events

Connect to `ws://localhost:8082`:

**Emit:**
- `subscribe:shipment` - Subscribe to shipment updates
- `subscribe:driver` - Subscribe to driver updates

**Listen:**
- `shipment_location_updated` - Real-time location
- `driver_location_updated` - Driver moved

## Troubleshooting

### "Firebase authentication is not configured"
- Backend needs Firebase Admin credentials
- Check `.env` file in `services/core-api`

### "401 Unauthorized"
- Token expired - Firebase SDK auto-refreshes on page reload
- Check `onAuthStateChanged` is set up correctly

### WebSocket not connecting
- Make sure notification service is running on port 8082
- Check CORS settings

### "Shipment not found"
- Create test data linked to your user's customer_id
- Or use the admin panel to assign existing shipments

## Next Steps

1. Add Google Maps for live tracking visualization
2. Add notifications when delivery status changes
3. Add ability to create new orders
4. Add driver rating system
5. Add push notifications (Firebase Cloud Messaging)
