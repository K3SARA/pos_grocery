import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./login";
import Cashier from "./Cashier";
import AdminDashboard from "./AdminDashboard";
import { getToken, getRole } from "./api";
import Returns from "./Returns";
import SalesHistory from "./SalesHistory";
import Reports from "./Reports";
import EndDay from "./EndDay";
import ItemWiseReport from "./ItemWiseReport";
import Stock from "./Stock";
import ReturnedStock from "./ReturnedStock";





const handlelogout = () => {
  // 1. Remove the token from local storage
  localStorage.removeItem("token");
  
  // 2. Clear any user state if you have one
  // setUser(null); 
    localStorage.removeItem("role"); 

  // 3. Redirect to login page or refresh
  window.location.href = "/login"; 
};




function PrivateRoute({ children, allow }) {
  const token = getToken();
  const role = getRole();

  if (!token) return <Navigate to="/login" replace />;

  // ✅ critical: role missing => clear token + go login (prevents blank screen loop)
  if (!role || role === "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    return <Navigate to="/login" replace />;
  }

  if (allow && role !== allow) {
    return <Navigate to={role === "admin" ? "/admin" : "/cashier"} replace />;
  }

  return children;
}


export default function App() {
  const [, setTick] = useState(0);
  const refresh = () => setTick((x) => x + 1);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    refresh();
  };

  const role = getRole();
  const token = getToken();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/history" element={<SalesHistory />} />
        <Route path="/reports" element={<Reports />} />
        <Route
  path="/reports/items"
  element={
    <PrivateRoute allow="admin">
      <ItemWiseReport />
    </PrivateRoute>
  }
/>
        <Route path="/end-day" element={<EndDay />} />
        <Route path="/returns" element={<Returns onLogout={handlelogout} />} />
        <Route
          path="/stock"
          element={
            <PrivateRoute allow="admin">
              <Stock />
            </PrivateRoute>
          }
        />
        <Route
          path="/stock/returned"
          element={
            <PrivateRoute allow="admin">
              <ReturnedStock />
            </PrivateRoute>
          }
        />




        <Route path="/login" element={<Login onLogin={refresh} />} />
        


        <Route
          path="/"
          element={
            token ? (
              <Navigate to={role === "admin" ? "/admin" : "/cashier"} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/admin"
          element={
            <PrivateRoute allow="admin">
              <AdminDashboard onLogout={logout} />
            </PrivateRoute>
          }
        />

        <Route
          path="/cashier"
          element={
            <PrivateRoute allow="cashier">
              <Cashier onLogout={logout} />
            </PrivateRoute>
          }
        />
        <Route
  path="/billing"
  element={
    <PrivateRoute allow="admin">
      <Cashier onLogout={logout} />
    </PrivateRoute>
  }
/>


        {/* Fallback: if route doesn't match */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
