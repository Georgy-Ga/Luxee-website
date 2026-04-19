import ApiError from '../exceptions/apiError.js';

export default function (requiredRole) {
	return function (req, res, next) {
		if (req.user.role !== requiredRole) {
			return next(
				ApiError.ForbiddenError(
					'Доступ разрешён только для роли: ' + requiredRole,
				),
			);
		}
		next();
	};
}
