/**
 * Vercel Serverless: carga la app Express compilada del workspace `backend`.
 * El build debe ejecutar antes `npm run build --workspace=dommuss-agenda-backend`.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Application } from 'express';

const require = createRequire(import.meta.url);
const entry = path.join(process.cwd(), 'backend', 'dist', 'server.js');
const mod = require(entry) as { default: Application };
export default mod.default;
