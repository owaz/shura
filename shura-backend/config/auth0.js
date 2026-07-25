const ensureTrailingSlash = (value) => (value.endsWith('/') ? value : `${value}/`);

const getAuth0Config = () => {
  const domain = (process.env.AUTH0_DOMAIN || '').trim();
  const audience = (process.env.AUTH0_AUDIENCE || '').trim();
  const claimNamespace = (process.env.AUTH0_CLAIM_NAMESPACE || 'https://shura.com').trim().replace(/\/+$/, '');

  if (!domain) {
    throw new Error('AUTH0_DOMAIN is required');
  }
  if (!audience) {
    throw new Error('AUTH0_AUDIENCE is required');
  }

  const issuerBaseUrl = ensureTrailingSlash(domain.startsWith('http') ? domain : `https://${domain}`);
  const issuer = issuerBaseUrl;

  return {
    domain,
    audience,
    issuer,
    issuerBaseUrl,
    claimNamespace,
  };
};

const getClaim = (payload, config, key) =>
  payload?.[`${config.claimNamespace}/${key}`] ?? payload?.[key] ?? null;

module.exports = {
  getAuth0Config,
  getClaim,
};
