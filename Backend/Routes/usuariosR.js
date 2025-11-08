// Routes/usuariosR.js
import { Router } from "express";
import { firestoreAdmin, authAdmin } from "../utils/db.js";
import { requireRole } from "../middlewares/requireRole.js";

export const userRouter = Router();

const ROLES_VALIDOS = ["ESTUDIANTE", "PROFESOR", "ADMIN", "USER"];

// Listar usuarios
userRouter.get("/usuarios", async (_req, res) => {
  try {
    const snap = await firestoreAdmin.collection("usuarios").get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "No se pudo obtener usuarios" });
  }
});

// Cambiar solo rol (admin)
userRouter.put("/usuarios/:id/rol", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body || {};
    if (!rol || !ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ error: "Rol inválido" });
    }
    await firestoreAdmin.collection("usuarios").doc(id).set({ rol }, { merge: true });
    await authAdmin.setCustomUserClaims(id, { role: rol });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "No se pudo actualizar el rol" });
  }
});

// Aprobar usuario con rol (admin)
userRouter.put("/usuarios/:id/aprobar", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body || {};
    if (!rol || !ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ error: "Rol inválido" });
    }
    await firestoreAdmin.collection("usuarios").doc(id).set(
      { rol, estado: "activo" },
      { merge: true }
    );
    await authAdmin.setCustomUserClaims(id, { role: rol });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "No se pudo aprobar al usuario" });
  }
});

// Rechazar usuario (admin)
userRouter.put("/usuarios/:id/rechazar", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    await firestoreAdmin.collection("usuarios").doc(id).set(
      { estado: "rechazada" },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "No se pudo rechazar al usuario" });
  }
});

// Eliminar usuario
userRouter.delete("/usuarios/:id", requireRole(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    await firestoreAdmin.collection("usuarios").doc(id).delete();
    await authAdmin.deleteUser(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "No se pudo eliminar el usuario" });
  }
});
