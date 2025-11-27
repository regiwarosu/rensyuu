export default {
  async fetch(request, env) {
    const CLIENT_ID = env.CLIENT_ID;
    const CLIENT_SECRET = env.CLIENT_SECRET;
    const REDIRECT_URI = env.REDIRECT_URI;

    const url = new URL(request.url);

    // ===== callback =====
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state"); // 元ページURL

      if (code) {
        try {
          const tokenData = await exchangeCodeForToken(
            code,
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
          );

          if (tokenData && tokenData.access_token) {
            // ★ state が相対URLなら絶対URLに変換
            const redirectUrl = normalizeRedirect(state || "/", request.url);
            return Response.redirect(redirectUrl, 302);
          }
        } catch (err) {
          return new Response(`OAuth エラー: ${err.message}`, { status: 500 });
        }
      }
    }

    // ===== 認証開始 =====
    const originalPage = url.searchParams.get("from") || "/";
    const discordAuthUrl =
      `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code&scope=identify%20guilds.join` +
      `&state=${encodeURIComponent(originalPage)}`;

    return Response.redirect(discordAuthUrl, 302);
  }
};

// ===== state を絶対URLに変換 =====
function normalizeRedirect(state, requestUrl) {
  try {
    return new URL(state).toString(); // 既に絶対URLならそのまま
  } catch {
    const base = new URL(requestUrl).origin;
    return new URL(state, base).toString(); // 相対URLなら origin を基準に絶対URL化
  }
}

// ===== 認可コード → トークン交換 =====
async function exchangeCodeForToken(code, client_id, client_secret, redirect_uri) {
  const params = new URLSearchParams();
  params.append("client_id", client_id);
  params.append("client_secret", client_secret);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirect_uri);
  params.append("scope", "identify guilds.join");

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (response.ok) return response.json();

  const text = await response.text();
  throw new Error(`Discord APIエラー: ${response.status} - ${text}`);
}
