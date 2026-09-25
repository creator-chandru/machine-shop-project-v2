// frontend/src/utils/auth.js

export const getUser = () => {
  const userData = localStorage.getItem("user");
  if (!userData) return null;
  try {
    return JSON.parse(userData);
  } catch (error) {
    return null;
  }
};

// AdminDashboard.jsx is looking exactly for this function name
export const removeToken = () => {
  localStorage.removeItem("user");
};

export const logout = (navigate) => {
  removeToken();
  navigate("/");
};