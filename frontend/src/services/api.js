import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("library_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("/auth/login")) {
      localStorage.removeItem("library_token");
      localStorage.removeItem("library_user");
      window.dispatchEvent(new Event("library:session-expired"));
    }
    return Promise.reject(error);
  }
);

export default api;
