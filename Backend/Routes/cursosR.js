import { Router } from "express";
import { firestoreAdmin } from "../utils/db.js";
import { requireRole } from "../middlewares/requireRole.js";

export const cursosR = Router();

cursosR.get("/", async (req, res) => {
  console.log("GET /api/cursos");
  try {
    const snapshot = await firestoreAdmin
      .collection("cursos")
      .orderBy("nombre", "asc")  
      .get();

    const cursos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("Cursos encontrados:", cursos.length);
    return res.json(cursos);
  } catch (error) {
    console.error("Error al obtener cursos:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Error al obtener cursos" });
  }
});

cursosR.post("/", async (req, res) => {
  console.log("POST /api/cursos body:", req.body);
  try {
    const { nombre, grado = "", seccion = "", anio } = req.body || {};

    if (!nombre || !anio) {
      return res.status(400).json({ error: "Nombre y año son obligatorios" });
    }

    const anioNum = Number(anio);
    if (Number.isNaN(anioNum)) {
      return res.status(400).json({ error: "El año debe ser numérico" });
    }

    const now = new Date();

    const data = {
      nombre: String(nombre).trim(),
      grado: String(grado || "").trim(),
      seccion: String(seccion || "").trim(),
      anio: anioNum,
      creadoEn: now,
      actualizadoEn: now,
    };

    const docRef = await firestoreAdmin.collection("cursos").add(data);

    const nuevo = { id: docRef.id, ...data };
    console.log("Curso creado:", nuevo);
    return res.status(201).json(nuevo);
  } catch (error) {
    console.error("Error al crear curso:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Error al crear curso" });
  }
});


cursosR.get(
  "/:cursoId/alumnos",
  requireRole(["ADMIN", "PROFESOR"]), 
  async (req, res) => {
    try {
      const { cursoId } = req.params;

      const gruposSnap = await firestoreAdmin
        .collection("grupos")
        .where("cursoId", "==", cursoId)
        .get();

      if (gruposSnap.empty) {
        return res.json([]);
      }

      const grupos = gruposSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const grupoIds = grupos.map((g) => g.id);

      const matriculas = [];
      for (const gid of grupoIds) {
        const mSnap = await firestoreAdmin
          .collection("matriculas")
          .where("grupoId", "==", gid)
          .where("estado", "==", "activa")
          .get();

        mSnap.forEach((doc) => {
          const data = doc.data() || {};
          matriculas.push({
            id: doc.id,
            grupoId: data.grupoId,
            alumnoId: data.alumnoId,
          });
        });
      }

      if (matriculas.length === 0) {
        return res.json([]);
      }

      const alumnoIds = [
        ...new Set(matriculas.map((m) => m.alumnoId).filter(Boolean)),
      ];

      const alumnos = [];
      for (const aid of alumnoIds) {
        const uRef = firestoreAdmin.collection("usuarios").doc(aid);
        const uSnap = await uRef.get();
        if (!uSnap.exists) continue;

        const uData = uSnap.data() || {};
        if ((uData.rol || "").toUpperCase() !== "ESTUDIANTE") continue;

        alumnos.push({
          id: uSnap.id,
          nombres: uData.nombres || "",
          apellidos: uData.apellidos || "",
          nombre: `${uData.nombres || ""} ${uData.apellidos || ""}`.trim(),
          email: uData.email || "",
          documento: uData.documento || "",
          grupoId: matriculas.find((m) => m.alumnoId === uSnap.id)?.grupoId,
        });
      }

      return res.json(alumnos);
    } catch (e) {
      console.error("GET /api/cursos/:cursoId/alumnos error:", e);
      return res
        .status(500)
        .json({ error: "Error obteniendo alumnos del curso" });
    }
  }
);
