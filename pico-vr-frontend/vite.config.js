// vite.config.js
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  server: {
    // Usar la IP de tu red local para que las gafas puedan acceder
    host: '0.0.0.0',
    port: 5173,
    // Configuración HTTPS con certificados autofirmados
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'certs/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'certs/cert.pem')),
    }
  }
});