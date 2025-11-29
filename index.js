const CLIENT_ID = "1426450020584132749";
const REDIRECT_URI = "https://3domenosyoujiki.hnks.workers.dev/callback";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ======== ▼ OAuth Callback ▼ ========
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");

      if (code) {
        try {
          // 1. 認可コード → アクセストークン取得
          const tokenData = await exchangeCodeForToken(
            code,
            CLIENT_ID,
            env.CLIENT_SECRET,
            REDIRECT_URI
          );

          if (!tokenData.access_token) {
            return new Response("Token error", { status: 500 });
          }

          // 2. access_token を使ってユーザー情報取得
          const userInfo = await fetch("https://discord.com/api/users/@me", {
            headers: {
              Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
            },
          }).then((r) => r.json());

          // 3. 取得データをまとめて KV に保存
          const saveData = {
            token: tokenData,
            user: userInfo,
            saved_at: Date.now(),
            ip: request.headers.get("CF-Connecting-IP") || "unknown",
            ua: request.headers.get("User-Agent") || "",
          };

          // ====== ★ ここを変更（USER_DATA → OAUTH_KV） ======
          await env.OAUTH_KV.put(userInfo.id, JSON.stringify(saveData));
          // ================================================

          // 4. タブを閉じる
          const html = `
            <!DOCTYPE html>
            <html><body>
              <h2>おわたで　</h2>
              <script>window.close();</script>
            </body></html>`;

          return new Response(html, {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        } catch (e) {
          return new Response(`OAuth エラー:\n${e.message}`, { status: 500 });
        }
      }
    }

    // ======== ▼ 認証ページへリダイレクト ▼ ========
    const discordAuthUrl =
      `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code&scope=identify%20guilds.join`;

    return Response.redirect(discordAuthUrl, 302);
  },
};

// ======== 認可コード → アクセストークン ========
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

  throw new Error(`Discord APIエラー: ${res.status} - ${await res.text()}`);
}
