// Backend/Routes/materialesR.js
import { Router } from "express";
import multer from "multer";
import { firestoreAdmin } from "../utils/db.js";
import { supabase } from "../utils/supabaseClient.js";
import { requireRole } from "../middlewares/requireRole.js";

export const materialesR = Router();

// Multer: guardamos archivos en memoria (buffer)
const upload = multer({ storage: multer.memoryStorage() });

const BUCKET = process.env.SUPABASE_BUCKET || "materiales";

/**
 * POST /api/materiales
 * Body (multipart/form-data):
 *  - titulo (string, required)
 *  - descripcion (string, optional)
 *  - cursoId (string, optional pero recomendado)
 *  - grupoId (string, optional)
 *  - enlace (string, optional)
 *  - archivo (file, optional)
 *
 * Reglas: titulo obligatorio y (archivo || enlace) obligatorio
 */
materialesR.post(
  "/materiales",
  requireRole(["PROFESOR"]), // solo docentes publican
  upload.single("archivo"),  // campo "archivo" en el form
  async (req, res) => {
    try {
      const uid = req.user?.uid || req.user?.id;
      const {
        titulo,
        descripcion = "",
        cursoId = "",
        grupoId = "",
        enlace = "",
      } = req.body || {};

      const archivo = req.file; // puede ser undefined

      if (!titulo || !titulo.trim()) {
        return res.status(400).json({ error: "El título es obligatorio." });
      }

      if (!archivo && !enlace) {
        return res.status(400).json({
          error: "Debes enviar al menos un archivo o un enlace.",
        });
      }

      let archivoUrl = null;
      let archivoNombre = null;
      let archivoTipo = null;

      // ── Subir archivo a Supabase si viene ─────────────────
      if (archivo) {
        archivoNombre = archivo.originalname;
        archivoTipo = archivo.mimetype || "application/octet-stream";

        // ruta dentro del bucket: cursoId/grupoId/timestamp_nombre
        const ts = Date.now();
        const safeNombre = archivoNombre.replace(/\s+/g, "_");
        const path = `${cursoId || "general"}/${grupoId || "sin-grupo"}/${ts}_${safeNombre}`;

        const { data, error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, archivo.buffer, {
            contentType: archivoTipo,
            upsert: false,
          });

        if (uploadError) {
          console.error("Error subiendo a Supabase:", uploadError);
          return res
            .status(500)
            .json({ error: "No se pudo subir el archivo." });
        }

        // url pública
        const { data: publicData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(data.path);

        archivoUrl = publicData.publicUrl;
      }

      // ── Guardar metadata en Firestore ─────────────────────
      const now = new Date();

      const docData = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        cursoId: cursoId || null,
        grupoId: grupoId || null,
        enlace: enlace.trim() || null,
        archivoUrl,
        archivoNombre,
        archivoTipo,
        profesorId: uid,
        createdAt: now,
        updatedAt: now,
      };

      const ref = await firestoreAdmin.collection("materiales").add(docData);

      res.status(201).json({ id: ref.id, ...docData });
    } catch (e) {
      console.error("POST /api/materiales error:", e);
      res.status(500).json({ error: "Error al publicar material." });
    }
  }
);

/**
 * GET /api/materiales
 * Query:
 *  - cursoId (optional)
 *  - grupoId (optional)
 *
 * Lista ordenada por fecha desc.
 */
materialesR.get(
  "/materiales",
  requireRole(["ADMIN", "PROFESOR", "ESTUDIANTE"]),
  async (req, res) => {
    try {
      const { cursoId, grupoId } = req.query || {};

      let ref = firestoreAdmin.collection("materiales");

      if (cursoId) {
        ref = ref.where("cursoId", "==", cursoId);
      }
      if (grupoId) {
        ref = ref.where("grupoId", "==", grupoId);
      }

      // ordenamos por fecha de publicación
      ref = ref.orderBy("createdAt", "desc");

      const snap = await ref.get();
      const materiales = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      res.json(materiales);
    } catch (e) {
      console.error("GET /api/materiales error:", e);
      res.status(500).json({ error: "Error al listar materiales." });
    }
  }
);

// PUT /api/materiales/:id
materialesR.put(
  "/materiales/:id",
  requireRole(["PROFESOR", "ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { titulo, descripcion, enlace } = req.body || {};

      const docRef = firestoreAdmin.collection("materiales").doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Material no encontrado" });
      }

      const data = snap.data() || {};
      const uid = req.user?.uid;

      // Solo el dueño o un admin pueden editar
      const rol = req.user?.rol || req.user?.role;
      if (rol !== "ADMIN" && data.profesorId && data.profesorId !== uid) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const patch = {
        updatedAt: new Date(),
      };
      if (typeof titulo === "string") patch.titulo = titulo.trim();
      if (typeof descripcion === "string")
        patch.descripcion = descripcion.trim();
      if (typeof enlace === "string") patch.enlace = enlace.trim();

      await docRef.update(patch);
      res.json({ ok: true });
    } catch (e) {
      console.error("PUT /api/materiales/:id error:", e);
      res.status(500).json({ error: "Error actualizando material" });
    }
  }
);

// DELETE /api/materiales/:id
materialesR.delete(
  "/materiales/:id",
  requireRole(["PROFESOR", "ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = firestoreAdmin.collection("materiales").doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Material no encontrado" });
      }

      const data = snap.data() || {};
      const uid = req.user?.uid;
      const rol = req.user?.rol || req.user?.role;

      if (rol !== "ADMIN" && data.profesorId && data.profesorId !== uid) {
        return res.status(403).json({ error: "No autorizado" });
      }

      // Borrar archivo de Supabase si existe
      const archivoPath = data.archivoPath;
      if (archivoPath) {
        try {
          await supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .remove([archivoPath]);
        } catch (e) {
          console.warn("No se pudo borrar archivo de Supabase:", e?.message);
        }
      }

      await docRef.delete();
      res.json({ ok: true });
    } catch (e) {
      console.error("DELETE /api/materiales/:id error:", e);
      res.status(500).json({ error: "Error eliminando material" });
    }
  }
);
