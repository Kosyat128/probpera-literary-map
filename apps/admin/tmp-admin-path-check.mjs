function sanitizePath(raw) { return (raw || '').trim(); }
function normalizeBasePathPath(value) {
  if (!value) return '/admin';
  if (value === '/') return '';
  const normalized = value.replace(/^\/+|\/+$/gu, '').replace(/\/{2,}/gu, '/');
  if (!normalized) return '';
  const parts = normalized.split('/').filter(Boolean);
  if ((parts[0] || '').toLowerCase() === 'admin') {
    while ((parts[1] || '').toLowerCase() === 'admin') {
      parts.shift();
    }
  }
  return parts.length ? `/${parts.join('/')}` : '';
}
function normalizeAdminRequestPath(pathname, configuredAdminBasePath) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  let rewritten = normalizedPath;

  if (!configuredAdminBasePath) {
    const legacyAdminPrefix = '/admin';
    const legacyPrefix = `${legacyAdminPrefix}/`;
    if (!(new RegExp(`^(?:${legacyAdminPrefix})(/.*)?$`, 'u').test(rewritten) && rewritten !== legacyAdminPrefix)) {
      return undefined;
    }
    while (rewritten === legacyAdminPrefix || rewritten.startsWith(legacyPrefix)) {
      const stripped = rewritten.length === legacyAdminPrefix.length ? '/' : rewritten.slice(legacyAdminPrefix.length);
      rewritten = stripped;
      if (stripped !== '/' && !stripped.startsWith('/')) {
        rewritten = `/${stripped}`;
      }
    }
    return rewritten === '' ? '/' : rewritten;
  }

  const legacyAdminPrefix = '/admin';
  if (configuredAdminBasePath === legacyAdminPrefix) {
    const repeatedPattern = `${configuredAdminBasePath}${configuredAdminBasePath}`;
    while (rewritten === repeatedPattern || rewritten.startsWith(`${repeatedPattern}/`)) {
      rewritten = `${configuredAdminBasePath}${rewritten.slice(repeatedPattern.length)}`;
    }
    if (rewritten === normalizedPath) return undefined;
    return rewritten === '' ? configuredAdminBasePath : rewritten;
  }

  if (!rewritten.startsWith(`${configuredAdminBasePath}/`) && rewritten !== configuredAdminBasePath) {
    return undefined;
  }
  return rewritten;
}

const tests = [
  {base:'/admin', paths:['/admin','/admin/','/admin/login','/admin/admin','/admin/admin/login','/dashboard']},
  {base:'/admin/admin', paths:['/admin/admin','/admin/admin/login','/admin/admin/admin/login']},
  {base:'', paths:['/admin','/admin/login','/admin/admin/login']},
];
for (const t of tests){
  const base = normalizeBasePathPath(t.base);
  console.log('\nbase raw',t.base,'=>',base);
  for (const p of t.paths){
    console.log(' ',p,'=>',normalizeAdminRequestPath(p,base));
  }
}
