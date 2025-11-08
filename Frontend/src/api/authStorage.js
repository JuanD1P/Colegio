export const saveSession = ({ token, role }) => {
  localStorage.setItem("auth-token", token);
  localStorage.setItem("user-role", role);
};
export const clearSession = () => {
  localStorage.removeItem("auth-token");
  localStorage.removeItem("user-role");
};
export const getToken = () => localStorage.getItem("auth-token");
export const getRole = () => localStorage.getItem("user-role");
