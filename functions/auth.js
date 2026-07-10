// Cloudflare Pages Function — OAuth "auth" step for Sveltia/Decap CMS (GitHub).
// Ported from sveltia-cms-auth (github.com/sveltia/sveltia-cms-auth).
const supportedProviders = ['github', 'gitlab'];
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const outputHTML = ({ provider = 'unknown', token, error, errorCode }) => {
  const state = error ? 'error' : 'success';
  const content = error ? { provider, error, errorCode } : { provider, token };
  return new Response(
    `<!doctype html><html><body><script>
      (() => {
        window.addEventListener('message', ({ data, origin }) => {
          if (data === 'authorizing:${provider}') {
            window.opener?.postMessage(
              'authorization:${provider}:${state}:${JSON.stringify(content)}',
              origin
            );
          }
        });
        window.opener?.postMessage('authorizing:${provider}', '*');
      })();
    </script></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Set-Cookie': `csrf-token=deleted; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure`,
      },
    },
  );
};

export async function onRequestGet({ request, env }) {
  const { url } = request;
  const { searchParams } = new URL(url);
  const { provider, site_id: domain } = Object.fromEntries(searchParams);

  if (!provider || !supportedProviders.includes(provider)) {
    return outputHTML({ error: 'Your Git backend is not supported by the authenticator.', errorCode: 'UNSUPPORTED_BACKEND' });
  }

  const { ALLOWED_DOMAINS, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_HOSTNAME = 'github.com' } = env;

  if (
    ALLOWED_DOMAINS &&
    !ALLOWED_DOMAINS.split(/,/).some((str) =>
      (domain ?? '').match(new RegExp(`^${escapeRegExp(str.trim()).replace('\\*', '.+')}$`)),
    )
  ) {
    return outputHTML({ provider, error: 'Your domain is not allowed to use the authenticator.', errorCode: 'UNSUPPORTED_DOMAIN' });
  }

  const csrfToken = globalThis.crypto.randomUUID().replaceAll('-', '');

  if (provider === 'github') {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return outputHTML({ provider, error: 'OAuth app client ID or secret is not configured.', errorCode: 'MISCONFIGURED_CLIENT' });
    }
    const params = new URLSearchParams({ client_id: GITHUB_CLIENT_ID, scope: 'repo,user', state: csrfToken });
    const authURL = `https://${GITHUB_HOSTNAME}/login/oauth/authorize?${params.toString()}`;
    return new Response('', {
      status: 302,
      headers: {
        Location: authURL,
        'Set-Cookie': `csrf-token=${provider}_${csrfToken}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure`,
      },
    });
  }

  return outputHTML({ provider, error: 'Unsupported provider.', errorCode: 'UNSUPPORTED_BACKEND' });
}
