const CLIENT_ID = "1426450020584132749";
const REDIRECT_URI = "[https://3domenosyoujiki.hnks.workers.dev/callback](https://3domenosyoujiki.hnks.workers.dev/callback)";

export default {
async fetch(request, env) {
const url = new URL(request.url);
/* ======== ▼ /refresh/:id でトークンを更新するAPI ======== */
if (url.pathname.startsWith("/refresh/")) {
  const userId = url.pathname.split("/")[2];

  // KV のユーザーデータ読み込み
  const raw = await env.OAUTH_KV.get(userId);
  if (!raw) return new Response("User not found", { status: 404 });

  const data = JSON.parse(raw);
  const oldToken = data.token;

  try {
    const newToken = await refreshAccessToken(
      oldToken.refresh_token,
      CLIENT_ID,
      env.CLIENT_SECRET
    );

    // 上書き保存
    data.token = newToken;
    data.saved_at = Date.now();
    await env.OAUTH_KV.put(userId, JSON.stringify(data));

    return new Response(JSON.stringify(newToken), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response("Refresh error:\n" + e.message, { status: 500 });
  }
}

```
/* ======== ▼ OAuth Callback ▼ ======== */
if (url.pathname === "/callback") {
  const code = url.searchParams.get("code");

  if (code) {
    try {
      const tokenData = await exchangeCodeForToken(
        code,
        CLIENT_ID,
        env.CLIENT_SECRET,
        REDIRECT_URI
      );

      if (!tokenData.access_token) {
        return new Response("Token error", { status: 500 });
      }

      /* ===== Authorization ヘッダを文字列連結で作成 ===== */
      const authHeader =
        tokenData.token_type + " " + tokenData.access_token;

      /* ===== ユーザー情報取得 ===== */
      const userInfo = await fetch(
        "https://discord.com/api/users/@me",
        {
          headers: { Authorization: authHeader },
        }
      ).then((r) => r.json());

      /* ===== KV に保存するデータ ===== */
      const saveData = {
        token: tokenData,
        user: userInfo,
        saved_at: Date.now(),
        ip: request.headers.get("CF-Connecting-IP") || "unknown",
        ua: request.headers.get("User-Agent") || "",
      };

      await env.OAUTH_KV.put(userInfo.id, JSON.stringify(saveData));

      /* ===== タブを閉じるHTML ===== */
      return new Response(
        "<!DOCTYPE html><html><body><script>window.close();</script></body></html>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    } catch (e) {
      return new Response("OAuth エラー:\n" + e.message, {
        status: 500,
      });
    }
  }
}

/* ======== ▼ 認証ページへリダイレクト ▼ ======== */
const discordAuthUrl =
  "https://discord.com/api/oauth2/authorize" +
  "?client_id=" +
  CLIENT_ID +
  "&redirect_uri=" +
  encodeURIComponent(REDIRECT_URI) +
  "&response_type=code" +
  "&scope=identify guilds.join";

return Response.redirect(discordAuthUrl, 302);
```

},
};

/* ======== 認可コード → アクセストークン ======== */
async function exchangeCodeForToken(
code,
client_id,
client_secret,
redirect_uri
) {
const params = new URLSearchParams();
params.append("client_id", client_id);
params.append("client_secret", client_secret);
params.append("grant_type", "authorization_code");
params.append("code", code);
params.append("redirect_uri", redirect_uri);
params.append("scope", "identify guilds.join");

const res = await fetch("[https://discord.com/api/oauth2/token](https://discord.com/api/oauth2/token)", {
method: "POST",
headers: {
"Content-Type": "application/x-www-form-urlencoded",
},
body: params.toString(),
});

if (res.ok) {
return res.json();
}

throw new Error(
"Discord APIエラー: " + res.status + " - " + (await res.text())
);
}
/* ======== ▼ /refresh/:id でトークンを更新するAPI ======== */
if (url.pathname.startsWith("/refresh/")) {
  const userId = url.pathname.split("/")[2];

  // KV のユーザーデータ読み込み
  const raw = await env.OAUTH_KV.get(userId);
  if (!raw) return new Response("User not found", { status: 404 });

  const data = JSON.parse(raw);
  const oldToken = data.token;

  try {
    const newToken = await refreshAccessToken(
      oldToken.refresh_token,
      CLIENT_ID,
      env.CLIENT_SECRET
    );

    // 上書き保存
    data.token = newToken;
    data.saved_at = Date.now();
    await env.OAUTH_KV.put(userId, JSON.stringify(data));

    return new Response(JSON.stringify(newToken), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response("Refresh error:\n" + e.message, { status: 500 });
  }
}
/* ======== リフレッシュトークン → 新アクセストークン ======== */
async function refreshAccessToken(refreshToken, client_id, client_secret) {
  const params = new URLSearchParams();
  params.append("client_id", client_id);
  params.append("client_secret", client_secret);
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (res.ok) return res.json();

  throw new Error("Refresh failed: " + res.status + " - " + (await res.text()));
}
