export default function (err, req, res, next) {
  console.log(err);
  // Проверяем, “наш” ApiError по наличию полей
  if(err.status && err.errors !== undefined) {
    return res.status(err.status).json({ message: err.message, errors: err.errors });
  }
  // Любая другая ошибка
  return res.status(500).json({ message: 'Непредвиденная ошибка' });
}