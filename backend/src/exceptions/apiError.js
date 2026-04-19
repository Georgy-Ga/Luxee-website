function ApiError(status, message, errors = []) {
  const err = new Error(message); // создаём реальный Error
  err.status = status;
  err.errors = errors;
  return err;
}

// статические методы, как в классе
ApiError.UnauthorizedError = () => ApiError(401, 'Пользователь не авторизован');
ApiError.BadRequest = (message, errors = []) => ApiError(400, message, errors);
ApiError.ForbiddenError = (message) => ApiError(403, message);

export default ApiError;
