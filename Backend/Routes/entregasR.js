// Backend/Routes/entregasR.js
import { Router } from "express";
import multer from "multer";
import { firestoreAdmin } from "../utils/db.js";
import { supabase } from "../utils/supabaseClient.js";
import { requireRole } from "../middlewares/requireRole.js";

export const entregasR = Router();

// Multer: archivo en memoria
const upload = multer({ storage: multer.memoryStorage() });

// nombre del bucket de supabase (puedes cambiar la env o el literal)
const BUCKET = process.env.SUPABASE_BUCKET_ENTREGAS || "entregas";

/**
 * POST /api/tareas/:tareaId/entregas
 * Estudiante sube / actualiza su entrega
 */
entregasR.post(
  "/tareas/:tareaId/entregas",
  requireRole(["ESTUDIANTE"]),
  upload.single("archivo"), // campo "archivo" en el form
  async (req, res) => {
    try {
      const tareaId = req.params.tareaId;
      const uid = req.user?.uid || req.user?.id;
      const { enlace = "" } = req.body || {};
      const archivo = req.file;

      if (!tareaId) {
        return res.status(400).json({ error: "Falta tareaId" });
      }

      if (!archivo && !enlace) {
        return res.status(400).json({
          error: "Debes adjuntar un archivo o proporcionar un enlace.",
        });
      }

      let archivoUrl = null;
      let archivoNombre = null;
      let archivoTipo = null;
      let archivoPath = null;

      // ── Subir a Supabase si hay archivo ─────────────────
      if (archivo) {
        archivoNombre = archivo.originalname;
        archivoTipo = archivo.mimetype || "application/octet-stream";

        const ts = Date.now();
        const safeName = archivoNombre.replace(/\s+/g, "_");
        const path = `${tareaId}/${uid}/${ts}_${safeName}`;

        const { data, error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, archivo.buffer, {
            contentType: archivoTipo,
            upsert: false,
          });

        if (uploadError) {
          console.error("Error subiendo entrega a Supabase:", uploadError);
          return res
            .status(500)
            .json({ error: "No se pudo subir el archivo de la entrega." });
        }

        const { data: publicData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(data.path);

        archivoUrl = publicData.publicUrl;
        archivoPath = data.path;
      }

      const now = new Date();

      const docData = {
        tareaId,
        alumnoId: uid,
        enlace: enlace.trim() || null,
        archivoUrl,
        archivoNombre,
        archivoTipo,
        archivoPath,
        entregadaEn: now,
        createdAt: now, // por si en el front usas createdAt
        updatedAt: now,
      };

      // Si ya tenía una entrega, la sobreescribimos (una por alumno y tarea)
      const existingSnap = await firestoreAdmin
        .collection("entregas")
        .where("tareaId", "==", tareaId)
        .where("alumnoId", "==", uid)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        const ref = existingSnap.docs[0].ref;
        await ref.set(docData, { merge: true });
        return res.status(200).json({ id: ref.id, ...docData });
      } else {
        const ref = await firestoreAdmin.collection("entregas").add(docData);
        return res.status(201).json({ id: ref.id, ...docData });
      }
    } catch (e) {
      console.error("POST /api/tareas/:tareaId/entregas error:", e);
      res.status(500).json({ error: "Error al registrar entrega." });
    }
  }
);

/**
 * GET /api/tareas/:tareaId/mi-entrega
 * Devuelve la entrega del alumno logueado para esa tarea
 */
entregasR.get(
  "/tareas/:tareaId/mi-entrega",
  requireRole(["ESTUDIANTE"]),
  async (req, res) => {
    try {
      const tareaId = req.params.tareaId;
      const uid = req.user?.uid || req.user?.id;

      const snap = await firestoreAdmin
        .collection("entregas")
        .where("tareaId", "==", tareaId)
        .where("alumnoId", "==", uid)
        .limit(1)
        .get();

      if (snap.empty) {
        return res.json(null);
      }

      const d = snap.docs[0];
      res.json({ id: d.id, ...d.data() });
    } catch (e) {
      console.error("GET /api/tareas/:tareaId/mi-entrega error:", e);
      res.status(500).json({ error: "Error al obtener tu entrega." });
    }
  }
);

/**
 * GET /api/tareas/:tareaId/entregas
 * Lista todas las entregas de la tarea (solo profesor/admin)
 * Enriquecido con datos básicos del alumno.
 */
entregasR.get(
  "/tareas/:tareaId/entregas",
  requireRole(["PROFESOR", "ADMIN"]),
  async (req, res) => {
    try {
      const { tareaId } = req.params;

      const snap = await firestoreAdmin
        .collection("entregas")
        .where("tareaId", "==", tareaId)
        .get();

      const entregasRaw = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // IDs únicos de alumnos
      const alumnoIds = [
        ...new Set(
          entregasRaw
            .map((e) => e.alumnoId)
            .filter((x) => x && typeof x === "string")
        ),
      ];

      const alumnosMap = {};

      if (alumnoIds.length > 0) {
        const promises = alumnoIds.map(async (uid) => {
          try {
            const doc = await firestoreAdmin
              .collection("usuarios")
              .doc(uid)
              .get();

            if (doc.exists) {
              const data = doc.data() || {};
              const nombres = data.nombres || data.nombre || "";
              const apellidos = data.apellidos || "";
              const nombreCompleto = `${nombres} ${apellidos}`.trim();

              alumnosMap[uid] = {
                id: uid,
                nombre: nombreCompleto,
                email: data.email || "",
              };
            }
          } catch (e) {
            console.warn("No se pudo leer datos del alumno", uid, e?.message);
          }
        });

        await Promise.all(promises);
      }

      const entregas = entregasRaw.map((e) => {
        const info = alumnosMap[e.alumnoId] || {};
        return {
          ...e,
          alumnoNombre: info.nombre || e.alumnoNombre || "",
          alumnoEmail: info.email || e.alumnoEmail || "",
        };
      });

      res.json(entregas);
    } catch (e) {
      console.error("GET /api/tareas/:tareaId/entregas error:", e);
      res.status(500).json({ error: "Error al listar entregas." });
    }
  }
);

/**
 * PUT /api/entregas/:id/calificar
 * Docente / admin asigna nota 0–100 a una entrega.
 * Body: { nota: number (0-100), comentario?: string }
 */
entregasR.put(
  "/entregas/:id/calificar",
  requireRole(["PROFESOR", "ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      let { nota, comentario = "" } = req.body || {};

      nota = Number(nota);
      if (Number.isNaN(nota)) {
        return res.status(400).json({ error: "La nota debe ser un número." });
      }
      if (nota < 0 || nota > 100) {
        return res
          .status(400)
          .json({ error: "La nota debe estar entre 0 y 100." });
      }

      const entregaRef = firestoreAdmin.collection("entregas").doc(id);
      const entregaSnap = await entregaRef.get();
      if (!entregaSnap.exists) {
        return res.status(404).json({ error: "Entrega no encontrada." });
      }

      const entregaData = entregaSnap.data() || {};
      const tareaId = entregaData.tareaId;
      const uid = req.user?.uid || req.user?.id;
      const rol = req.user?.rol || req.user?.role;

      // (Opcional) Verificar que el profesor sea dueño de la tarea
      if (tareaId && rol !== "ADMIN") {
        try {
          const tareaSnap = await firestoreAdmin
            .collection("tareas")
            .doc(tareaId)
            .get();

          if (tareaSnap.exists) {
            const tareaData = tareaSnap.data() || {};
            const profesorId = tareaData.profesorId;
            if (profesorId && profesorId !== uid) {
              return res.status(403).json({
                error: "No estás autorizado para calificar esta entrega.",
              });
            }
          }
        } catch (e) {
          console.warn("No se pudo verificar profesor de la tarea:", e?.message);
        }
      }

      const patch = {
        nota,
        comentario: comentario.trim() || null,
        calificadaEn: new Date(),
        calificadaPor: uid,
      };

      await entregaRef.update(patch);

      res.json({ ok: true, id, ...patch });
    } catch (e) {
      console.error("PUT /api/entregas/:id/calificar error:", e);
      res.status(500).json({ error: "Error al guardar la nota." });
    }
  }
);
