import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api"; // if your api file path differs, change it

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      const login = async () =>
        apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });

      let data;
      try {
        data = await login();
      } catch (err) {
        // auto-create first admin if no users exist, then retry login once
        try {
          await apiFetch("/auth/setup-admin", {
            method: "POST",
            body: JSON.stringify({ username, password }),
          });
          data = await login();
        } catch {
          throw err;
        }
      }

      localStorage.setItem("token", data.token);

      const role = data.user?.role ?? data.role;
      if (!role) throw new Error("Role missing from login response");
      localStorage.setItem("role", role);

      onLogin?.();
      navigate(role === "admin" ? "/admin" : "/cashier", { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed");
    }
  }

  return (
    <div className="auth-page">
      <h2>POS Login</h2>

      <form onSubmit={submit}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ color: "#ffffff" }}>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              color: "#ffffff",
              background: "#0f172a",
              border: "1px solid #334155",
            }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ color: "#ffffff" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              color: "#ffffff",
              background: "#0f172a",
              border: "1px solid #334155",
            }}
          />
        </div>

        {error ? <div style={{ color: "red", marginBottom: 10 }}>{error}</div> : null}

        <button style={{ width: "100%", padding: 12 }}>Login</button>
      </form>
    </div>
  );
}
