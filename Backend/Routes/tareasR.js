// Backend/Routes/tareasR.js
import { Router } from "express";
import { firestoreAdmin } from "../utils/db.js";
import { requireRole } from "../middlewares/requireRole.js";

export const tareasR = Router();

/**
 * Helper para calcular estado de la tarea según la fecha límite.
 * Devuelve "activa" o "expirada".
 */
function calcularEstado(fechaLimite) {
  if (!fechaLimite) return "activa";
  const ahora = new Date();

  // fechaLimite puede ser:
  // - Date
  // - Timestamp de Firestore (tiene toDate)
  // - {_seconds, _nanoseconds}
  try {
    let d = fechaLimite;
    if (typeof fechaLimite.toDate === "function") {
      d = fechaLimite.toDate();
    } else if (fechaLimite._seconds || fechaLimite.seconds) {
      const secs = fechaLimite._seconds ?? fechaLimite.seconds;
      d = new Date(secs * 1000);
    }
    return d < ahora ? "expirada" : "activa";
  } catch {
    return "activa";
  }
}

/**
 * POST /api/tareas
 * Body (JSON):
 *  - titulo        (string, requerido)
 *  - descripcion   (string, requerido)
 *  - fechaLimite   (string ISO, requerido)
 *  - cursoId       (string, opcional)
 *  - grupoId       (string, opcional pero recomendado)
 */
tareasR.post(
  "/tareas",
  requireRole(["PROFESOR"]), // solo docente crea
  async (req, res) => {
    try {
      const uid = req.user?.uid || req.user?.id;
      const {
        titulo,
        descripcion,
        fechaLimite,
        cursoId = "",
        grupoId = "",
      } = req.body || {};

      if (!titulo || !titulo.trim()) {
        return res
          .status(400)
          .json({ error: "El título de la tarea es obligatorio." });
      }

      if (!descripcion || !descripcion.trim()) {
        return res
          .status(400)
          .json({ error: "La descripción de la tarea es obligatoria." });
      }

      if (!fechaLimite) {
        return res
          .status(400)
          .json({ error: "La fecha límite de la tarea es obligatoria." });
      }

      const fecha = new Date(fechaLimite);
      if (Number.isNaN(fecha.getTime())) {
        return res
          .status(400)
          .json({ error: "La fecha límite no tiene un formato válido." });
      }

      const now = new Date();

      const docData = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        cursoId: cursoId || null,
        grupoId: grupoId || null,
        profesorId: uid,
        fechaLimite: fecha,
        createdAt: now,
        updatedAt: now,
      };

      const ref = await firestoreAdmin.collection("tareas").add(docData);

      // calculamos estado para devolver al front
      const estado = calcularEstado(fecha);

      res.status(201).json({
        id: ref.id,
        ...docData,
        estado,
      });
    } catch (e) {
      console.error("POST /api/tareas error:", e);
      res.status(500).json({ error: "Error al crear tarea." });
    }
  }
);

/**
 * GET /api/tareas
 * Query:
 *  - cursoId (opcional)
 *  - grupoId (opcional)
 *  - estado  (opcional: "activa" | "expirada")
 *
 * Nota: para evitar problemas de índices, filtramos en NodeJS.
 */
tareasR.get(
  "/tareas",
  requireRole(["ADMIN", "PROFESOR", "ESTUDIANTE"]),
  async (req, res) => {
    try {
      const { cursoId, grupoId, estado } = req.query || {};

      const snap = await firestoreAdmin.collection("tareas").get();

      const tareas = snap.docs
        .map((d) => {
          const data = d.data() || {};
          const est = calcularEstado(data.fechaLimite);
          return {
            id: d.id,
            ...data,
            estado: est,
          };
        })
        .filter((t) => {
          if (cursoId && t.cursoId !== cursoId) return false;
          if (grupoId && t.grupoId !== grupoId) return false;
          if (estado && t.estado !== estado) return false;
          return true;
        })
        // ordenadas por fecha límite ascendente
        .sort((a, b) => {
          const da = a.fechaLimite?.toDate
            ? a.fechaLimite.toDate()
            : new Date(a.fechaLimite);
          const db = b.fechaLimite?.toDate
            ? b.fechaLimite.toDate()
            : new Date(b.fechaLimite);
          return da - db;
        });

      res.json(tareas);
    } catch (e) {
      console.error("GET /api/tareas error:", e);
      res.status(500).json({ error: "Error al listar tareas." });
    }
  }
);

/**
 * PUT /api/tareas/:id
 * Body: { titulo?, descripcion?, fechaLimite? }
 */
tareasR.put(
  "/tareas/:id",
  requireRole(["PROFESOR", "ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { titulo, descripcion, fechaLimite } = req.body || {};

      const docRef = firestoreAdmin.collection("tareas").doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Tarea no encontrada" });
      }

      const data = snap.data() || {};
      const uid = req.user?.uid || req.user?.id;
      const rol = req.user?.rol || req.user?.role;

      // Solo dueño o admin
      if (rol !== "ADMIN" && data.profesorId && data.profesorId !== uid) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const patch = {
        updatedAt: new Date(),
      };

      if (typeof titulo === "string") patch.titulo = titulo.trim();
      if (typeof descripcion === "string")
        patch.descripcion = descripcion.trim();

      if (typeof fechaLimite === "string" && fechaLimite) {
        const fecha = new Date(fechaLimite);
        if (Number.isNaN(fecha.getTime())) {
          return res
            .status(400)
            .json({ error: "La nueva fecha límite no es válida." });
        }
        patch.fechaLimite = fecha;
      }

      await docRef.update(patch);
      res.json({ ok: true });
    } catch (e) {
      console.error("PUT /api/tareas/:id error:", e);
      res.status(500).json({ error: "Error actualizando tarea" });
    }
  }
);

/**
 * DELETE /api/tareas/:id
 */
tareasR.delete(
  "/tareas/:id",
  requireRole(["PROFESOR", "ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = firestoreAdmin.collection("tareas").doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Tarea no encontrada" });
      }

      const data = snap.data() || {};
      const uid = req.user?.uid || req.user?.id;
      const rol = req.user?.rol || req.user?.role;

      if (rol !== "ADMIN" && data.profesorId && data.profesorId !== uid) {
        return res.status(403).json({ error: "No autorizado" });
      }

      await docRef.delete();
      res.json({ ok: true });
    } catch (e) {
      console.error("DELETE /api/tareas/:id error:", e);
      res.status(500).json({ error: "Error eliminando tarea" });
    }
  }
);
