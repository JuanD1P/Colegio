import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ensureServiceAccountFile() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const filePath = path.join(__dirname, "../serviceAccountKey.runtime.json");
    fs.writeFileSync(filePath, process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "utf8");
    return filePath;
  }
  const localPath = path.join(__dirname, "../serviceAccountKey.json");
  if (fs.existsSync(localPath)) return localPath;

  throw new Error("No se encontró Service Account (ENV o archivo).");
}

const keyPath = ensureServiceAccountFile();
const raw = fs.readFileSync(keyPath, "utf8");
const sa = JSON.parse(raw);


process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: sa.project_id,
  });
}

console.log("🔧 Admin project_id:", sa.project_id);

export const authAdmin = admin.auth();
export const firestoreAdmin = admin.firestore();
export { admin };
