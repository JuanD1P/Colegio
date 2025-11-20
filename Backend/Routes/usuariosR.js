// Routes/usuariosR.js
import { Router } from "express";
import { firestoreAdmin, authAdmin } from "../utils/db.js";
import { requireRole } from "../middlewares/requireRole.js";

export const userRouter = Router();

const ROLES_VALIDOS = ["ESTUDIANTE", "PROFESOR", "ADMIN", "USER"];

// Listar usuarios (ADMIN)
userRouter.get("/usuarios", requireRole(["ADMIN"]), async (_req, res) => {
  try {
    const snap = await firestoreAdmin.collection("usuarios").get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "No se pudo obtener usuarios" });
  }
});

// Cambiar solo rol (admin)
userRouter.put(
  "/usuarios/:id/rol",
  requireRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { rol } = req.body || {};
      if (!rol || !ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ error: "Rol inválido" });
      }
      await firestoreAdmin
        .collection("usuarios")
        .doc(id)
        .set({ rol }, { merge: true });
      await authAdmin.setCustomUserClaims(id, { role: rol });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: "No se pudo actualizar el rol" });
    }
  }
);

// Aprobar usuario con rol (admin)
userRouter.put(
  "/usuarios/:id/aprobar",
  requireRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { rol } = req.body || {};
      if (!rol || !ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ error: "Rol inválido" });
      }
      await firestoreAdmin
        .collection("usuarios")
        .doc(id)
        .set({ rol, estado: "activo" }, { merge: true });
      await authAdmin.setCustomUserClaims(id, { role: rol });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: "No se pudo aprobar al usuario" });
    }
  }
);

// Rechazar usuario (admin)
userRouter.put(
  "/usuarios/:id/rechazar",
  requireRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      await firestoreAdmin
        .collection("usuarios")
        .doc(id)
        .set({ estado: "rechazada" }, { merge: true });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: "No se pudo rechazar al usuario" });
    }
  }
);

// Eliminar usuario (admin)
userRouter.delete(
  "/usuarios/:id",
  requireRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      await firestoreAdmin.collection("usuarios").doc(id).delete();
      await authAdmin.deleteUser(id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: "No se pudo eliminar el usuario" });
    }
  }
);

/* ──────────────────────────────────────
   NUEVO: perfil del usuario logueado
   GET /api/mi-perfil
   PUT /api/mi-perfil
   Roles permitidos: cualquier usuario autenticado
   ────────────────────────────────────── */

// leer mi perfil
userRouter.get(
  "/mi-perfil",
  requireRole(["ADMIN", "PROFESOR", "ESTUDIANTE", "USER"]),
  async (req, res) => {
    try {
      const uid = req.user?.uid || req.user?.id;
      if (!uid) {
        return res.status(401).json({ error: "Sin usuario en la sesión" });
      }

      const snap = await firestoreAdmin.collection("usuarios").doc(uid).get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Perfil no encontrado" });
      }

      res.json({ id: snap.id, ...snap.data() });
    } catch (e) {
      console.error("GET /mi-perfil error:", e);
      res.status(500).json({ error: "Error cargando perfil" });
    }
  }
);

// actualizar mi perfil
userRouter.put(
  "/mi-perfil",
  requireRole(["ADMIN", "PROFESOR", "ESTUDIANTE", "USER"]),
  async (req, res) => {
    try {
      const uid = req.user?.uid || req.user?.id;
      if (!uid) {
        return res.status(401).json({ error: "Sin usuario en la sesión" });
      }

      const {
        nombres,
        apellidos,
        tipoDoc,
        documento,
        telefono,
        direccion,
        grado,
        seccion,
        fechaNac,
        acudienteNombre,
        acudienteTelefono,
        tituloAcademico,
      } = req.body || {};

      const patch = {
        nombres: (nombres || "").trim(),
        apellidos: (apellidos || "").trim(),
        tipoDoc: (tipoDoc || "").trim(),
        documento: (documento || "").trim(),
        telefono: (telefono || "").trim(),
        direccion: (direccion || "").trim(),
        grado: (grado || "").trim(),
        seccion: (seccion || "").trim(),
        fechaNac: (fechaNac || "").trim(),
        acudienteNombre: (acudienteNombre || "").trim(),
        acudienteTelefono: (acudienteTelefono || "").trim(),
        tituloAcademico: (tituloAcademico || "").trim(),
        perfilCompleto: true,
        actualizadoEn: new Date(),
      };

      await firestoreAdmin
        .collection("usuarios")
        .doc(uid)
        .set(patch, { merge: true });

      res.json({ ok: true });
    } catch (e) {
      console.error("PUT /mi-perfil error:", e);
      res.status(500).json({ error: "Error actualizando perfil" });
    }
  }
);
