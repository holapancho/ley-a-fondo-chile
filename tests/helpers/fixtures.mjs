import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export const fixture = (nombre) => path.join(DIR, nombre);
export const leerFixture = (nombre) => readFileSync(fixture(nombre), 'utf8');
