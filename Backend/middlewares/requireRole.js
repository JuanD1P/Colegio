export const requireRole = (roles = []) => (req, res, next) => {
  const role = req.user?.role || "USER";
  if (!roles.length || roles.includes(role)) return next();
  return res.status(403).json({ error: "Permisos insuficientes" });
};
