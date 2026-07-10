// Cloudflare Pages Function — OAuth "callback" step for Sveltia/Decap CMS (GitHub).
// Ported from sveltia-cms-auth (github.com/sveltia/sveltia-cms-auth).
const supportedProviders = ['github', 'gitlab'];

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
  const { url, headers } = request;
  const { searchParams } = new URL(url);
  const { code, state } = Object.fromEntries(searchParams);

  const [, provider, csrfToken] =
    headers.get('Cookie')?.match(/\bcsrf-token=([a-z-]+?)_([0-9a-f]{32})\b/) ?? [];

  if (!provider || !supportedProviders.includes(provider)) {
    return outputHTML({ error: 'Your Git backend is not supported by the authenticator.', errorCode: 'UNSUPPORTED_BACKEND' });
  }
  if (!code || !state) {
    return outputHTML({ provider, error: 'Failed to receive an authorization code. Please try again later.', errorCode: 'AUTH_CODE_REQUEST_FAILED' });
  }
  if (!csrfToken || state !== csrfToken) {
    return outputHTML({ provider, error: 'Potential CSRF attack detected. Authentication flow aborted.', errorCode: 'CSRF_DETECTED' });
  }

  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_HOSTNAME = 'github.com' } = env;

  if (provider === 'github') {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return outputHTML({ provider, error: 'OAuth app client ID or secret is not configured.', errorCode: 'MISCONFIGURED_CLIENT' });
    }
    const tokenURL = `https://${GITHUB_HOSTNAME}/login/oauth/access_token`;
    const requestBody = { code, client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET };

    let response;
    let token = '';
    let error = '';
    try {
      response = await fetch(tokenURL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch {}
    if (!response) {
      return outputHTML({ provider, error: 'Failed to request an access token. Please try again later.', errorCode: 'TOKEN_REQUEST_FAILED' });
    }
    try {
      ({ access_token: token, error } = await response.json());
    } catch {
      return outputHTML({ provider, error: 'Server responded with malformed data. Please try again later.', errorCode: 'MALFORMED_RESPONSE' });
    }
    return outputHTML({ provider, token, error });
  }

  return outputHTML({ provider, error: 'Unsupported provider.', errorCode: 'UNSUPPORTED_BACKEND' });
}
