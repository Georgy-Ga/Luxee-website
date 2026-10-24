export default function (err, req, res, next) {
  // 401 — штатная ситуация (нет сессии / протух refresh после смены секретов):
  // в лог не печатаем, иначе каждый заход без куки даёт страшный стектрейс.
  if (err?.status === 401) {
    return res.status(401).json({ message: err.message, errors: err.errors });
  }
  console.log(err);
  // Проверяем, “наш” ApiError по наличию полей
  if(err.status && err.errors !== undefined) {
    return res.status(err.status).json({ message: err.message, errors: err.errors });
  }
  // Любая другая ошибка
  return res.status(500).json({ message: 'Непредвиденная ошибка' });
}