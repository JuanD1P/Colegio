import { authAdmin, firestoreAdmin } from "../utils/db.js";

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Falta token (Bearer)" });

    const decoded = await authAdmin.verifyIdToken(token);
    let role = decoded.role; 
    if (!role) {
      const snap = await firestoreAdmin.collection("usuarios").doc(decoded.uid).get();
      role = snap.exists ? (snap.data().rol || "USER") : "USER";
    }

    req.user = { uid: decoded.uid, email: decoded.email, role };
    next();
  } catch (e) {
    console.error("Auth error:", e?.message);
    res.status(401).json({ error: "No autorizado" });
  }
};
