export default {
  async fetch(request, env) {
    const CLIENT_ID = env.CLIENT_ID;
    const CLIENT_SECRET = env.CLIENT_SECRET;
    const REDIRECT_URI = env.REDIRECT_URI;
    const BOT_TOKEN = env.BOT_TOKEN;

    const url = new URL(request.url);

    // ======== callback 処理 ========
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state"); // 戻り先

      if (code) {
        try {
          const tokenData = await exchangeCodeForToken(
            code,
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
          );

          if (tokenData && tokenData.access_token) {
            // ★ state を安全に絶対URL化
            const redirectUrl = normalizeRedirect(state || "/", request.url);

            return Response.redirect(redirectUrl, 302);
          } else {
            return new Response("連携失敗: トークン交換エラー", {
              status: 500,
            });
          }
        } catch (err) {
          return new Response(`OAuth エラー: ${err.message}`, { status: 500 });
        }
      }
    }

    // ======== 認証開始（Discordへリダイレクト） ========

    // 戻り先 URL を state に入れる
    const originalUrl = request.url;

    const discordAuthUrl =
      `https://discord.com/api/oauth2/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code&scope=identify%20guilds.join` +
      `&state=${encodeURIComponent(originalUrl)}`;

    return Response.redirect(discordAuthUrl, 302);
  },
};

// ====================
// state を絶対URLに直す
// ====================
function normalizeRedirect(state, requestUrl) {
  try {
    // state が絶対URLなら成功する
    return new URL(state).toString();
  } catch (err) {
    // 相対URLならここに来る
    const base = new URL(requestUrl).origin;
    return new URL(state, base).toString();
  }
}

// ====================
// 認可コード → アクセストークン交換
// ====================
async function exchangeCodeForToken(code, client_id, client_secret, redirect_uri) {
  const params = new URLSearchParams();
  params.append("client_id", client_id);
  params.append("client_secret", client_secret);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirect_uri);
  params.append("scope", "identify guilds.join");

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (res.ok) return res.json();

  const text = await res.text();
  throw new Error(`Discord APIエラー: ${res.status} - ${text}`);
}
