export function publicRole(role) {
  return { id: String(role._id), code: role.code, name: role.name, description: role.description, permissions: [...role.permissions], scopeMode: role.scopeMode, isProtected: role.isProtected, version: role.version };
}

export function publicUser(user, sessionUser = false) {
  const role = user.roleId?._id ? user.roleId : null;
  return {
    id: String(user._id), name: user.name, email: user.email, role: role?.code || null,
    roleId: role ? String(role._id) : null, roleLabel: role?.name || 'Unassigned',
    scopeMode: role?.scopeMode || 'assigned', isActive: user.isActive,
    mustChangePassword: user.mustChangePassword, version: user.version,
    createdAt: user.createdAt, lastLoginAt: user.lastLoginAt || null,
    ...(sessionUser ? {
      permissions: role ? [...role.permissions] : [], roleVersion: role?.version || 0,
      siteIds: user.siteIds.map(String), farmIds: user.farmIds.map(String),
    } : {}),
  };
}

export function actorFrom(user) {
  return { ...publicUser(user, true), organizationId: String(user.organizationId), authVersion: user.authVersion, isProtected: Boolean(user.roleId?.isProtected) };
}
