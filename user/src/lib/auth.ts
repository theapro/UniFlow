export const auth = {
  storeAuth: (token: string, user?: any) => {
    if (typeof window === "undefined") return;

    localStorage.setItem("token", token);
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    }

    // Middleware can only read cookies
    const maxAge = 7 * 24 * 60 * 60; // 7 days
    document.cookie = `token=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
  },

  getStoredToken: () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  },

  getStoredUser: () => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  logout: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "token=; Max-Age=0; Path=/; SameSite=Lax";
  },
};
