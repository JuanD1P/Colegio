import { Router } from "express";
import { firestoreAdmin } from "../utils/db.js";
import { requireRole } from "../middlewares/requireRole.js";

export const gruposR = Router();


function ensureAdmin(req, res, next) {
  const rol = req.user?.rol || req.user?.role;
  if (rol !== "ADMIN") {
    return res.status(403).json({ error: "Solo administradores" });
  }
  next();
}


gruposR.get("/grupos", ensureAdmin, async (_req, res) => {
  try {
    const snap = await firestoreAdmin.collection("grupos").get();
    const grupos = snap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        nombre: data.nombre || null,

        cursoId: data.cursoId || null,
        cursoNombre: data.cursoNombre || null,

        profesorId: data.profesorId || null,
        profesorNombre: data.profesorNombre || null,
        profesorEmail: data.profesorEmail || null,

        horario: Array.isArray(data.horario) ? data.horario : [],
        alumnos: Array.isArray(data.alumnos) ? data.alumnos : [],
        totalAlumnos: Array.isArray(data.alumnos) ? data.alumnos.length : 0,
      };
    });

    res.json(grupos);
  } catch (e) {
    console.error("GET /api/grupos error:", e);
    res.status(500).json({ error: "Error cargando grupos" });
  }
});


gruposR.post("/grupos", ensureAdmin, async (req, res) => {
  try {
    const { cursoId, nombre, profesorId } = req.body || {};

    if (!cursoId || !nombre || !profesorId) {
      return res
        .status(400)
        .json({ error: "cursoId, nombre y profesorId son obligatorios" });
    }


    let cursoNombre = null;
    try {
      const cursoSnap = await firestoreAdmin
        .collection("cursos")
        .doc(cursoId)
        .get();
      if (cursoSnap.exists) {
        const cData = cursoSnap.data() || {};
        cursoNombre = cData.nombre || cData.titulo || null;
      }
    } catch (e) {
      console.warn("WARN leyendo curso en POST /grupos:", e?.message || e);
    }


    let profesorNombre = null;
    let profesorEmail = null;
    try {
      const profSnap = await firestoreAdmin
        .collection("usuarios")
        .doc(profesorId)
        .get();
      if (profSnap.exists) {
        const u = profSnap.data() || {};
        profesorNombre =
          u.nombre ||
          u.nombre_completo ||
          `${u.nombres || ""} ${u.apellidos || ""}`.trim() ||
          null;
        profesorEmail = u.email || null;
      }
    } catch (e) {
      console.warn("WARN leyendo profesor en POST /grupos:", e?.message || e);
    }

    const now = new Date();

    const grupoData = {
      nombre,
      cursoId,
      cursoNombre,

      profesorId,
      profesorNombre,
      profesorEmail,

      horario: [],
      alumnos: [],
      creadoEn: now,
      actualizadoEn: now,
    };

    const ref = await firestoreAdmin.collection("grupos").add(grupoData);

    res.status(201).json({ id: ref.id, ...grupoData });
  } catch (e) {
    console.error("POST /api/grupos error:", e);
    res.status(500).json({ error: "Error creando grupo" });
  }
});


gruposR.post("/grupos/:id/matriculas", ensureAdmin, async (req, res) => {
  try {
    const grupoId = req.params.id;
    const { alumnoUid } = req.body || {};

    if (!alumnoUid) {
      return res.status(400).json({ error: "alumnoUid es obligatorio" });
    }

    const ref = firestoreAdmin.collection("grupos").doc(grupoId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Grupo no encontrado" });
    }

    await ref.update({
      alumnos: (firestoreAdmin.FieldValue
        ? firestoreAdmin.FieldValue.arrayUnion(alumnoUid)
        : [...(snap.data()?.alumnos || []), alumnoUid]),
      actualizadoEn: new Date(),
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/grupos/:id/matriculas error:", e);
    res.status(500).json({ error: "Error al matricular alumno" });
  }
});

gruposR.get("/profes", ensureAdmin, async (_req, res) => {
  try {
    const snap = await firestoreAdmin
      .collection("usuarios")
      .where("rol", "==", "PROFESOR")
      .where("estado", "==", "activo")
      .get();

    const profes = snap.docs.map((d) => {
      const u = d.data() || {};
      return {
        id: d.id,
        nombre:
          u.nombre ||
          u.nombre_completo ||
          `${u.nombres || ""} ${u.apellidos || ""}`.trim() ||
          null,
        email: u.email || null,
      };
    });

    res.json(profes);
  } catch (e) {
    console.error("GET /api/profes error:", e);
    res.status(500).json({ error: "Error cargando profesores" });
  }
});

gruposR.put("/grupos/:id", ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { horario } = req.body || {};

    const patch = {
      actualizadoEn: new Date(),
    };
    if (Array.isArray(horario)) patch.horario = horario;

    await firestoreAdmin.collection("grupos").doc(id).update(patch);

    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/grupos/:id error:", e);
    res.status(500).json({ error: "Error actualizando grupo" });
  }
});


gruposR.get(
  "/grupos/:id/alumnos",
  requireRole(["ADMIN", "PROFESOR"]),
  async (req, res) => {
    try {
      const grupoId = req.params.id;

      const snap = await firestoreAdmin
        .collection("matriculas")
        .where("grupoId", "==", grupoId)
        .where("estado", "==", "activa")
        .get();

      if (snap.empty) {
        return res.json([]);
      }

      const alumnoIds = [
        ...new Set(
          snap.docs
            .map((d) => d.data()?.alumnoId)
            .filter((x) => typeof x === "string")
        ),
      ];

      const alumnos = [];
      for (const aid of alumnoIds) {
        const uRef = firestoreAdmin.collection("usuarios").doc(aid);
        const uSnap = await uRef.get();
        if (!uSnap.exists) continue;

        const u = uSnap.data() || {};
        if ((u.rol || "").toUpperCase() !== "ESTUDIANTE") continue;

        alumnos.push({
          id: uSnap.id,
          nombres: u.nombres || "",
          apellidos: u.apellidos || "",
          nombre: `${u.nombres || ""} ${u.apellidos || ""}`.trim(),
          email: u.email || "",
          documento: u.documento || "",
        });
      }

      res.json(alumnos);
    } catch (e) {
      console.error("GET /api/grupos/:id/alumnos error:", e);
      res.status(500).json({ error: "Error cargando alumnos del grupo" });
    }
  }
);

gruposR.get(
  "/profesores/:profesorId/grupos",
  requireRole(["ADMIN", "PROFESOR"]),
  async (req, res) => {
    try {
      const { profesorId } = req.params;
      const { cursoId } = req.query || {};

      let ref = firestoreAdmin
        .collection("grupos")
        .where("profesorId", "==", profesorId);

      if (cursoId) {
        ref = ref.where("cursoId", "==", cursoId);
      }

      const snap = await ref.get();

      const grupos = snap.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          nombre: data.nombre || null,
          cursoId: data.cursoId || null,
          cursoNombre: data.cursoNombre || null,
          profesorId: data.profesorId || null,
          profesorNombre: data.profesorNombre || null,
          profesorEmail: data.profesorEmail || null,
          horario: Array.isArray(data.horario) ? data.horario : [],
          totalAlumnos: Array.isArray(data.alumnos) ? data.alumnos.length : 0,
        };
      });

      res.json(grupos);
    } catch (e) {
      console.error("GET /api/profesores/:profesorId/grupos error:", e);
      res.status(500).json({ error: "Error cargando grupos del profesor" });
    }
  }
);
