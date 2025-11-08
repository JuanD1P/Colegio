// Backend/index.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import admin from 'firebase-admin';
import { authAdmin, firestoreAdmin } from './utils/db.js';
import { requireAuth } from './middlewares/requireAuth.js';
import { userRouter } from './Routes/usuariosR.js';

const app = express();

app.use(cors({
  origin: process.env.FRONT_ORIGIN?.split(',') || ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ---------- Anti-rebote de tokens (5s) ----------
const seenTokens = new Map();
const TTL_MS = 5000;
function isDuplicateToken(idToken) {
  const now = Date.now();
  for (const [tok, t] of [...seenTokens.entries()]) {
    if (now - t > TTL_MS) seenTokens.delete(tok);
  }
  if (!idToken) return false;
  if (seenTokens.has(idToken)) return true;
  seenTokens.set(idToken, now);
  return false;
}

// ---------- Bootstrap de admin por ENV ----------
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase();

// ---------- /auth/session ----------
// REEMPLAZA COMPLETO tu /auth/session por este (Backend/index.js)

app.post('/auth/session', async (req, res) => {
  const rid = Math.random().toString(36).slice(2, 8); // id del request
  try {
    console.log('→ /auth/session rid=', rid, 'Node:', process.version);
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Falta idToken' });

    // --- DEBUG payload
    const parts = idToken.split('.');
    if (parts.length !== 3) return res.status(400).json({ error: 'idToken inválido' });
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    console.log('   aud=', payload.aud, 'email=', payload.email);
    console.log('   now=', Math.floor(Date.now()/1000), 'iat=', payload.iat, 'exp=', payload.exp);

    // --- VERIFY
    let decoded;
    try {
      decoded = await authAdmin.verifyIdToken(idToken);
      console.log('   verify OK rid=', rid, 'uid=', decoded.uid);
    } catch (e) {
      console.error('   verify FAIL rid=', rid, e?.code, e?.message || e);
      return res.status(401).json({ error: 'Token inválido (verify)' });
    }

    const uid = decoded.uid;
    const email = (decoded.email || '').toLowerCase();

    // --- FIRESTORE GET
    let snap;
    try {
      const ref = firestoreAdmin.collection('usuarios').doc(uid);
      snap = await ref.get();
      console.log('   firestore get OK rid=', rid, 'exists=', snap.exists);
    } catch (e) {
      console.error('   firestore GET FAIL rid=', rid, e?.code, e?.message || e);
      return res.status(500).json({ error: 'Error leyendo usuario' });
    }

    // --- CREAR SI NO EXISTE
    if (!snap.exists) {
      const base = {
        email,
        rol: 'USER',
        estado: 'pendiente',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      try {
        await firestoreAdmin.collection('usuarios').doc(uid).set(base);
        console.log('   firestore set (new) OK rid=', rid);
      } catch (e) {
        console.error('   firestore SET (new) FAIL rid=', rid, e?.code, e?.message || e);
        return res.status(500).json({ error: 'Error creando usuario' });
      }
      return res.status(403).json({ ok: false, error: 'Cuenta creada. Pendiente de aprobación.' });
    }

    // --- VALIDAR ESTADO
    const data = snap.data() || {};
    console.log('   user estado=', data.estado, 'rol=', data.rol);
    if (data.estado === 'pendiente') {
      return res.status(403).json({ ok: false, error: 'Cuenta pendiente de aprobación.' });
    }
    if (data.estado === 'rechazada') {
      return res.status(403).json({ ok: false, error: 'Cuenta rechazada.' });
    }

    // --- OK
    console.log('   login OK rid=', rid, 'rol=', data.rol || 'USER');
    return res.json({ ok: true, uid, rol: data.rol || 'USER' });

  } catch (e) {
    // ESTE CATCH SOLO SI SE ESCAPÓ ALGO; LOGUEA TODO
    console.error('❌ /auth/session CATCH rid=', rid, 'code=', e?.code, 'msg=', e?.message || e);
    console.error(e?.stack);
    return res.status(401).json({ error: 'Token inválido' });
  }
});


// Rutas protegidas
app.use('/api', requireAuth, userRouter);

// Healthcheck opcional
app.get('/healthz', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en funcionamiento en http://localhost:${PORT}`);
});

app.get('/debug/firestore', async (_req, res) => {
  try {
    const snap = await firestoreAdmin.collection('usuarios').limit(1).get();
    res.json({ ok: true, count: snap.size });
  } catch (e) {
    console.error('DEBUG FS FAIL:', e?.code, e?.message || e);
    res.status(500).json({ error: e?.message || 'fs error' });
  }
});
