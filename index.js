/**

* Discord OAuth + KV保存 + リフレッシュトークン対応 完全版
  */

const CLIENT_ID = "1426450020584132749";
const REDIRECT_URI = "[https://3domenosyoujiki.hnks.workers.dev/callback](https://3domenosyoujiki.hnks.workers.dev/callback)";

export default {
async fetch(request, env) {
const url = new URL(request.url);

```
// ======== ▼ OAuth コールバック ▼ ========
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

      // 2. access_token でユーザー情報取得
      const userInfo = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
        },
      }).then((r) => r.json());

      // 3. KVに保存するデータ
      const saveData = {
        token: tokenData,
        user: userInfo,
        saved_at: Date.now(),
        ip: request.headers.get("CF-Connecting-IP") || "unknown",
        ua: request.headers.get("User-Agent") || "",
      };

      // 4. KVに保存
      await env.OAUTH_KV.put(userInfo.id, JSON.stringify(saveData));

      // 5. タブを閉じる
      const html = `
        <!DOCTYPE html>
        <html><body>
          <h2>認証完了！タブを閉じます。</h2>
          <script>window.close();</script>
        </body></html>
      `;
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (e) {
      return new Response(`OAuth エラー:\n${e.message}`, { status: 500 });
    }
  }
}

// ======== ▼ トークン確認用（期限切れなら自動更新） ▼ ========
if (url.pathname === "/check") {
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const raw = await env.OAUTH_KV.get(id);
  if (!raw) return new Response("Not found", { status: 404 });

  let data = JSON.parse(raw);
  let token = data.token;

  const tokenAge = Date.now() - data.saved_at;
  const expired = tokenAge > 3600 * 1000; // 1時間

  // ▼ アクセストークンが期限切れなら更新
  if (expired && token.refresh_token) {
    const newToken = await refreshAccessToken(
      token.refresh_token,
      CLIENT_ID,
      env.CLIENT_SECRET
    );

    // 保存データ更新
    data.token = newToken;
    data.saved_at = Date.now();

    await env.OAUTH_KV.put(id, JSON.stringify(data));

    token = newToken;
  }

  return new Response(
    JSON.stringify({ user: data.user, token }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// ======== ▼ 認証ページへリダイレクト ▼ ========
const discordAuthUrl =
  `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code&scope=identify%20guilds.join`;

return Response.redirect(discordAuthUrl, 302);
```

},
};

// ======== 認可コード → アクセストークン取得 ========
async function exchangeCodeForToken(code, client_id, client_secret, redirect_uri) {
const params = new URLSearchParams();
params.append("client_id", client_id);
params.append("client_secret", client_secret);
params.append("grant_type", "authorization_code");
params.append("code", code);
params.append("redirect_uri", redirect_uri);
params.append("scope", "identify guilds.join");

const res = await fetch("[https://discord.com/api/oauth2/token](https://discord.com/api/oauth2/token)", {
method: "POST",
headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: params.toString(),
});

if (res.ok) return res.json();
throw new Error(`Discord APIエラー: ${res.status} - ${await res.text()}`);
}

// ======== リフレッシュトークン → 新アクセストークン取得 ========
async function refreshAccessToken(refresh_token, client_id, client_secret) {
const params = new URLSearchParams();
params.append("client_id", client_id);
params.append("client_secret", client_secret);
params.append("grant_type", "refresh_token");
params.append("refresh_token", refresh_token);

const res = await fetch("[https://discord.com/api/oauth2/token](https://discord.com/api/oauth2/token)", {
method: "POST",
headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: params.toString(),
});

if (!res.ok) throw new Error("Failed to refresh token: " + (await res.text()));
return res.json();
}
