// Backend/Routes/cursosR.js
import { Router } from "express";
import { firestoreAdmin } from "../utils/db.js";

export const cursosR = Router();

/**
 * GET /api/cursos
 */
cursosR.get("/", async (req, res) => {
  console.log("GET /api/cursos");
  try {
    // 👇 Versión simple, SIN índices compuestos
    const snapshot = await firestoreAdmin
      .collection("cursos")
      .orderBy("nombre", "asc")   // o "anio" si prefieres
      .get();

    const cursos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("Cursos encontrados:", cursos.length);
    return res.json(cursos);
  } catch (error) {
    console.error("Error al obtener cursos:", error);
    // Manda el mensaje al frontend para poder verlo
    return res
      .status(500)
      .json({ error: error?.message || "Error al obtener cursos" });
  }
});

/**
 * POST /api/cursos
 */
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
