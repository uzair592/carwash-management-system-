import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import LoginScreen from './components/LoginScreen';
import { useAuth } from './context/AuthContext';
function AuthenticatedApp() {
  const {
    currentUser,
    loading
  } = useAuth();
  return loading ? <p className="p-6">Loading…</p> : currentUser ? <App /> : <LoginScreen />;
}
import { AuthProvider } from './context/AuthContext';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode>
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  </React.StrictMode>);
