import axios from "axios";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const raw of cookies) {
    const [k, ...rest] = raw.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
  },
  // Allows sending cookies cross-port on localhost if needed.
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    // Only access localStorage on client side
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token") || getCookie("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // Check if we're not already on the login page to avoid infinite redirects
      if (!window.location.pathname.includes("/login")) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        document.cookie = "token=; Max-Age=0; Path=/; SameSite=Lax";

        // Get the current language from pathname
        const pathParts = window.location.pathname.split("/");
        const lang = pathParts[1] || "en";

        window.location.href = `/${lang}/login?error=session_expired`;
      }
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
