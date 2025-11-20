// Backend/Routes/matriculasR.js
import { Router } from "express";
import { firestoreAdmin } from "../utils/db.js";
import { requireRole } from "../middlewares/requireRole.js"; // 👈 NUEVO

export const matriculasR = Router();

// ───────── Helper: solo admin ─────────
function ensureAdmin(req, res, next) {
  const rol = req.user?.rol || req.user?.role;
  if (rol !== "ADMIN") {
    return res.status(403).json({ error: "Solo administradores" });
  }
  next();
}

// ───────────────────────────────
// POST /api/matriculas
// Crea matrícula { grupoId, alumnoId }
// Estado por defecto: "activa"
// ───────────────────────────────
matriculasR.post("/matriculas", ensureAdmin, async (req, res) => {
  try {
    const { grupoId, alumnoId } = req.body || {};

    if (!grupoId || !alumnoId) {
      return res
        .status(400)
        .json({ error: "grupoId y alumnoId son obligatorios" });
    }

    // Validar que el grupo exista
    const grupoRef = firestoreAdmin.collection("grupos").doc(grupoId);
    const grupoSnap = await grupoRef.get();
    if (!grupoSnap.exists) {
      return res.status(404).json({ error: "Grupo no encontrado" });
    }

    // Validar que el alumno exista
    const alumRef = firestoreAdmin.collection("usuarios").doc(alumnoId);
    const alumSnap = await alumRef.get();
    if (!alumSnap.exists) {
      return res.status(404).json({ error: "Alumno no encontrado" });
    }

    // Evitar duplicados activos
    const dupSnap = await firestoreAdmin
      .collection("matriculas")
      .where("grupoId", "==", grupoId)
      .where("alumnoId", "==", alumnoId)
      .where("estado", "==", "activa")
      .limit(1)
      .get();

    if (!dupSnap.empty) {
      return res
        .status(400)
        .json({ error: "El alumno ya está matriculado en este grupo" });
    }

    const now = new Date();

    const docRef = await firestoreAdmin.collection("matriculas").add({
      grupoId,
      alumnoId,
      estado: "activa",
      createdAt: now,
    });

    res.status(201).json({
      id: docRef.id,
      grupoId,
      alumnoId,
      estado: "activa",
      createdAt: now,
    });
  } catch (e) {
    console.error("POST /api/matriculas error:", e);
    res.status(500).json({ error: "Error creando matrícula" });
  }
});

// ───────────────────────────────
// GET /api/matriculas
// Filtros opcionales: ?grupoId=&alumnoId=&estado=
// Por defecto: solo estado = "activa"
// (solo ADMIN)
// ───────────────────────────────
matriculasR.get("/matriculas", ensureAdmin, async (req, res) => {
  try {
    const { grupoId, alumnoId, estado } = req.query || {};

    let ref = firestoreAdmin.collection("matriculas");

    if (grupoId) ref = ref.where("grupoId", "==", grupoId);
    if (alumnoId) ref = ref.where("alumnoId", "==", alumnoId);
    // Por defecto solo activas
    if (estado) {
      ref = ref.where("estado", "==", estado);
    } else {
      ref = ref.where("estado", "==", "activa");
    }

    const snap = await ref.get();
    const out = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        grupoId: data.grupoId || null,
        alumnoId: data.alumnoId || null,
        estado: data.estado || null,
        createdAt: data.createdAt || null,
      };
    });

    res.json(out);
  } catch (e) {
    console.error("GET /api/matriculas error:", e);
    res.status(500).json({ error: "Error cargando matrículas" });
  }
});

// ───────────────────────────────
// DELETE /api/matriculas/:id
// Marca la matrícula como "baja"
// ───────────────────────────────
matriculasR.delete("/matriculas/:id", ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const ref = firestoreAdmin.collection("matriculas").doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Matrícula no encontrada" });
    }

    await ref.update({
      estado: "baja",
      updatedAt: new Date(),
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/matriculas/:id error:", e);
    res.status(500).json({ error: "Error eliminando matrícula" });
  }
});

// ───────────────────────────────
// GET /api/alumnos/:alumnoId/grupos
// Devuelve los grupos (con info de curso y profe) de un alumno
// Roles: ADMIN o el propio ESTUDIANTE
// ───────────────────────────────
matriculasR.get(
  "/alumnos/:alumnoId/grupos",
  requireRole(["ADMIN", "ESTUDIANTE"]),
  async (req, res) => {
    try {
      const { alumnoId } = req.params;
      const rol = (req.user?.rol || req.user?.role || "").toUpperCase();
      const uid = req.user?.uid || req.user?.id;

      // Si es estudiante, solo puede ver sus propios grupos
      if (rol === "ESTUDIANTE" && uid && uid !== alumnoId) {
        return res.status(403).json({ error: "No autorizado" });
      }

      // 1) Matriculas activas del alumno
      const matSnap = await firestoreAdmin
        .collection("matriculas")
        .where("alumnoId", "==", alumnoId)
        .where("estado", "==", "activa")
        .get();

      if (matSnap.empty) {
        return res.json([]);
      }

      const grupoIds = [
        ...new Set(
          matSnap.docs
            .map((d) => d.data()?.grupoId)
            .filter((x) => typeof x === "string")
        ),
      ];

      // 2) Traer info de los grupos
      const grupos = [];
      for (const gid of grupoIds) {
        const gRef = firestoreAdmin.collection("grupos").doc(gid);
        const gSnap = await gRef.get();
        if (!gSnap.exists) continue;

        const g = gSnap.data() || {};

        grupos.push({
          id: gSnap.id,
          nombreGrupo: g.nombre || "",
          cursoId: g.cursoId || null,
          cursoNombre: g.cursoNombre || "",
          profesorId: g.profesorId || null,
          profesorNombre: g.profesorNombre || "",
          profesorEmail: g.profesorEmail || "",
          horario: Array.isArray(g.horario) ? g.horario : [],
        });
      }

      res.json(grupos);
    } catch (e) {
      console.error("GET /api/alumnos/:alumnoId/grupos error:", e);
      res
        .status(500)
        .json({ error: "Error cargando grupos del estudiante" });
    }
  }
);
