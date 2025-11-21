import { Router } from "express";
import multer from "multer";
import { firestoreAdmin } from "../utils/db.js";
import { supabase } from "../utils/supabaseClient.js";
import { requireRole } from "../middlewares/requireRole.js";

export const materialesR = Router();


const upload = multer({ storage: multer.memoryStorage() });

const BUCKET = process.env.SUPABASE_BUCKET || "materiales";


materialesR.post(
  "/materiales",
  requireRole(["PROFESOR"]),
  upload.single("archivo"),  
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

      const archivo = req.file; 

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
      let archivoPath = null; 

      if (archivo) {
        archivoNombre = archivo.originalname;
        archivoTipo = archivo.mimetype || "application/octet-stream";

        const ts = Date.now();
        const safeNombre = archivoNombre.replace(/\s+/g, "_");
        archivoPath = `${
          cursoId || "general"
        }/${grupoId || "sin-grupo"}/${ts}_${safeNombre}`;

        const { data, error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(archivoPath, archivo.buffer, {
            contentType: archivoTipo,
            upsert: false,
          });

        if (uploadError) {
          console.error("Error subiendo a Supabase:", uploadError);
          return res
            .status(500)
            .json({ error: "No se pudo subir el archivo." });
        }

        const { data: publicData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(data.path);

        archivoUrl = publicData.publicUrl;
      }


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
        archivoPath, 
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


materialesR.get(
  "/materiales",
  requireRole(["ADMIN", "PROFESOR", "ESTUDIANTE"]),
  async (req, res) => {
    try {
      const { cursoId, grupoId } = req.query || {};

      let ref = firestoreAdmin.collection("materiales");

      if (grupoId) {
        ref = ref.where("grupoId", "==", grupoId);
      }
      if (cursoId) {
        ref = ref.where("cursoId", "==", cursoId);
      }

      const snap = await ref.get();

      const materiales = snap.docs.map((d) => {
        const data = d.data() || {};
        const ts = data.createdAt;

        let createdAt = null;
        if (ts) {
          if (typeof ts?.toDate === "function") {
            createdAt = ts.toDate().toISOString();
          } else if (ts._seconds || ts.seconds) {
            const secs = ts._seconds ?? ts.seconds;
            createdAt = new Date(secs * 1000).toISOString();
          } else {
            createdAt = ts; 
          }
        }

        return {
          id: d.id,
          titulo: data.titulo || "",
          descripcion: data.descripcion || "",
          enlace: data.enlace || "",
          archivoUrl: data.archivoUrl || "",
          archivoNombre: data.archivoNombre || "",
          archivoTipo: data.archivoTipo || "",
          cursoId: data.cursoId || null,
          grupoId: data.grupoId || null,
          profesorId: data.profesorId || null,
          createdAt,
        };
      });

      materiales.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      res.json(materiales);
    } catch (e) {
      console.error("GET /api/materiales error:", e);
      res
        .status(500)
        .json({ error: e?.message || "Error al listar materiales." });
    }
  }
);


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
          await supabase.storage.from(BUCKET).remove([archivoPath]);
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
