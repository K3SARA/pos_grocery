/* eslint-env browser */

const API =
    (process.env.REACT_APP_API_URL || "http://localhost:4000").replace(/\/+$/, "");




// token + role helpers (App.js needs these)
export function getToken() {
  return localStorage.getItem("token");
}
export function setToken(token) {
  if (!token) localStorage.removeItem("token");
  else localStorage.setItem("token", token);
}

export function getRole() {
  return localStorage.getItem("role");
}
export function setRole(role) {
  if (!role) localStorage.removeItem("role");
  else localStorage.setItem("role", role);
}

// main fetch helper (adds Authorization automatically)
export async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}
