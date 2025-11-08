import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase/client";
import api from "../api/axios";
import { saveSession, getRole } from "../api/authStorage";


const PrivateRoute = ({ children, allowedRoles = [] }) => {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
  
      const u = auth.currentUser;
      if (!u) { setReady(true); setOk(false); return; }

      try {
        const freshToken = await u.getIdToken(true);

        let role = getRole();
        if (!role) {
          const { data } = await api.post("/auth/session", { idToken: freshToken });
          role = data.rol; 
          saveSession({ token: freshToken, role });
        } else {

          saveSession({ token: freshToken, role });
        }

        const allowed = allowedRoles.length ? allowedRoles.includes(role) : true;
        setOk(allowed);
      } catch (e) {
        setOk(false);
      } finally {
        setReady(true);
      }
    })();
  }, [allowedRoles]);

  if (!ready) return <div style={{ padding: 16 }}>Cargando…</div>;
  if (!ok) return <Navigate to="/userlogin" replace />;
  return children;
};

export default PrivateRoute;
