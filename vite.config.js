import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const certDir = path.resolve(process.cwd(), ".local-certs");
  const certPath = path.join(certDir, "localhost-cert.pem");
  const keyPath = path.join(certDir, "localhost-key.pem");
  const useTrustedLocalCert = existsSync(certPath) && existsSync(keyPath);
  const firebaseAuthOrigin = env.VITE_FIREBASE_AUTH_DOMAIN
    ? `https://${env.VITE_FIREBASE_AUTH_DOMAIN}`
    : null;

  return {
    plugins: [
      react(),
      ...(useTrustedLocalCert
        ? []
        : [basicSsl({ certDir, domains: ["localhost"], name: "localhost" })]),
    ],
    server: {
      host: "localhost",
      port: 5173,
      strictPort: true,
      ...(useTrustedLocalCert
        ? {
            https: {
              cert: readFileSync(certPath),
              key: readFileSync(keyPath),
            },
          }
        : {}),
      proxy: firebaseAuthOrigin
        ? {
            "/__/auth": {
              target: firebaseAuthOrigin,
              changeOrigin: true,
              secure: true,
            },
            "/__/firebase": {
              target: firebaseAuthOrigin,
              changeOrigin: true,
              secure: true,
            },
          }
        : undefined,
    },
  };
});
