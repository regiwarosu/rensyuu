const CLIENT_ID_VALUE = "1426450020584132749";
const REDIRECT_URI_VALUE = "https://3domenosyoujiki.hnks.workers.dev/callback";

export default {
  async fetch(request, env) {
    const CLIENT_ID = CLIENT_ID_VALUE;
    const CLIENT_SECRET = env.CLIENT_SECRET;
    const REDIRECT_URI = REDIRECT_URI_VALUE;

    const url = new URL(request.url);

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");

      if (code) {
        try {
          const tokenData = await exchangeCodeForToken(
            code,
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
          );

          if (tokenData && tokenData.access_token) {
            // 認証成功 → タブを閉じる HTML を返す
            const html = `
              <!DOCTYPE html>
              <html lang="ja">
              <body>
                <script>
                  window.close();
                </script>
              </body>
              </html>
            `;
            return new Response(html, {
              status: 200,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          } else {
            return new Response("連携失敗: トークン交換エラー", { status: 500 });
          }
        } catch (err) {
          return new Response(`OAuth エラー: ${err.message}`, { status: 500 });
        }
      }
    }

    // 認証開始
    const discordAuthUrl =
      `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code&scope=identify%20guilds.join`;

    return Response.redirect(discordAuthUrl, 302);
  },
};

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
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (res.ok) return res.json();

  const text = await res.text();
  throw new Error(`Discord APIエラー: ${res.status} - ${text}`);
}
