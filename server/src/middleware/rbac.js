import { forbidden } from '../lib/errors.js';
import { userHasPermission, userIsStaff } from '../lib/permissions.js';

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) return next(forbidden('Authentication required'));
    if (!userHasPermission(req.user, permission)) return next(forbidden(`Missing permission: ${permission}`));
    return next();
  };
}

export function requireStaff(req, _res, next) {
  if (!req.user || !userIsStaff(req.user)) return next(forbidden('Staff access required'));
  return next();
}
