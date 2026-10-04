// VERBOSE-логи: детали только при LOG_VERBOSE=1, иначе тихо.
// Обычные console.log/error НЕ трогаем. Использование:
//   import { vlog } from '../verbose.js';  // путь подправить под файл
//   vlog('[Tag] шумная деталь');
// Важно: dotenv грузится первым в backend/index.js, но скрипты-миграции
// могут читать env позже — флаг считывается один раз при импорте,
// меняется только рестартом. Работает и в Docker (env из compose),
// и под npm run dev (env из backend/.env).
const VERBOSE =
	process.env.LOG_VERBOSE === '1' || process.env.LOG_VERBOSE === 'true';

export const vlog = (...args) => {
	if (VERBOSE) console.log(...args);
};

export default { VERBOSE, vlog };
