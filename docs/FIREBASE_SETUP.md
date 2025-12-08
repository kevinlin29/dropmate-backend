# Firebase Authentication Setup Guide

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `dropmate` (or your choice)
4. Follow the setup wizard

## 2. Enable Authentication

1. In Firebase Console, click "Authentication" in the left sidebar
2. Click "Get started"
3. Enable sign-in methods you want:
   - **Email/Password** (recommended)
   - **Google** (for social login)
   - **Facebook**, **GitHub**, etc. (optional)

## 3. Get Service Account Credentials

1. In Firebase Console, click the gear icon ⚙️ → "Project settings"
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Save the downloaded JSON file securely

## 4. Configure Backend Environment Variables

From the downloaded JSON file, extract these values and add to your `.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
```

**Important**:
- Keep the `\n` characters in the private key
- Wrap the private key in double quotes
- Never commit the .env file to git

## 5. Configure Frontend (React)

### Install Firebase SDK

```bash
npm install firebase
```

### Initialize Firebase in React

```javascript
// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSy...", // From Firebase Console
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### Get Firebase Config

1. In Firebase Console → Project Settings
2. Scroll down to "Your apps"
3. Click the web icon `</>` to add a web app
4. Copy the `firebaseConfig` object

## 6. Frontend Authentication Examples

### Sign Up

```javascript
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

async function signUp(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Get Firebase ID token
    const token = await userCredential.user.getIdToken();

    // Store token for API calls
    localStorage.setItem('authToken', token);

    return token;
  } catch (error) {
    console.error('Sign up error:', error.message);
    throw error;
  }
}
```

### Sign In

```javascript
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

async function signIn(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const token = await userCredential.user.getIdToken();
    localStorage.setItem('authToken', token);

    return token;
  } catch (error) {
    console.error('Sign in error:', error.message);
    throw error;
  }
}
```

### Google Sign-In

```javascript
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase';

async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const token = await result.user.getIdToken();
    localStorage.setItem('authToken', token);

    return token;
  } catch (error) {
    console.error('Google sign in error:', error.message);
    throw error;
  }
}
```

### Sign Out

```javascript
import { signOut } from 'firebase/auth';
import { auth } from './firebase';

async function logout() {
  try {
    await signOut(auth);
    localStorage.removeItem('authToken');
  } catch (error) {
    console.error('Sign out error:', error.message);
  }
}
```

### Make Authenticated API Calls

```javascript
async function fetchUserShipments() {
  const token = localStorage.getItem('authToken');

  const response = await fetch('http://localhost:8080/api/users/me/shipments', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired - redirect to login
      window.location.href = '/login';
    }
    throw new Error('Failed to fetch shipments');
  }

  return response.json();
}
```

### Auto-Refresh Tokens

```javascript
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in - refresh token
    const token = await user.getIdToken(true); // Force refresh
    localStorage.setItem('authToken', token);
  } else {
    // User is signed out
    localStorage.removeItem('authToken');
  }
});
```

## 7. React Context for Auth

```javascript
// src/contexts/AuthContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        setToken(idToken);
        setCurrentUser(user);
      } else {
        setToken(null);
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    token,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
```

## 8. Protected Route Component

```javascript
// src/components/ProtectedRoute.js
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  return children;
}

export default ProtectedRoute;
```

## 9. API Endpoints Available

Once authenticated, these endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/me` | GET | Get user profile |
| `/api/users/me` | PATCH | Update profile (name, phone) |
| `/api/users/me/stats` | GET | Get delivery statistics |
| `/api/users/me/orders` | GET | Get user's orders |
| `/api/users/me/shipments` | GET | Get user's packages with live tracking |
| `/api/users/me/shipments/:id` | GET | Get specific package with live location |

All endpoints require:
```
Authorization: Bearer <firebase-token>
```

## 10. Testing

### Test with cURL

First, get a Firebase ID token from your React app or use the Firebase REST API:

```bash
# Get user's shipments
curl http://localhost:8080/api/users/me/shipments \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

### Expected Response

```json
[
  {
    "id": 1,
    "tracking_number": "TRACK001",
    "status": "in_transit",
    "driver_name": "John Driver",
    "current_location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "timestamp": "2025-11-15T17:30:00Z"
    }
  }
]
```

## Security Notes

- ✅ Firebase handles password hashing and security
- ✅ Tokens are automatically verified by Firebase
- ✅ Backend only sees verified user information
- ✅ Users can only access their own data
- ✅ Firebase tokens expire after 1 hour (auto-refreshed by SDK)
- ⚠️ Keep service account credentials secure
- ⚠️ Never expose Firebase private key in client code
- ⚠️ Use environment variables for all secrets

## Troubleshooting

### Error: "Failed to initialize Firebase Admin SDK"
- Check that all environment variables are set correctly
- Verify the private key includes `\n` for line breaks
- Make sure the private key is wrapped in quotes

### Error: "Invalid authentication token"
- Token may have expired - refresh it on the frontend
- Verify the token is being sent in the Authorization header
- Check that Firebase project ID matches

### Error: "Shipment not found or does not belong to you"
- This is correct - user can only see their own shipments
- Create test data for the logged-in user

## Next Steps

1. Set up Firebase project
2. Add credentials to `.env`
3. Test authentication with Postman or cURL
4. Integrate with React frontend
5. Add error handling and loading states
6. Implement auto-token refresh
