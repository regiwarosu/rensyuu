const CLIENT_ID = "1426450020584132749";
const REDIRECT_URI = "[https://3domenosyoujiki.hnks.workers.dev/callback](https://3domenosyoujiki.hnks.workers.dev/callback)";

export default {
async fetch(request, env) {
const url = new URL(request.url);

```
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

const userInfo = await fetch("https://discord.com/api/users/@me", {
  headers: {
    Authorization: tokenData.token_type + " " + tokenData.access_token,
  },
}).then((r) => r.json());

      const saveData = {
        token: tokenData,
        user: userInfo,
        saved_at: Date.now(),
        ip: request.headers.get("CF-Connecting-IP") || "unknown",
        ua: request.headers.get("User-Agent") || "",
      };

      await env.OAUTH_KV.put(userInfo.id, JSON.stringify(saveData));

      return new Response(
        "<script>window.close();</script>",
        { headers: { "Content-Type": "text/html" } }
      );
    } catch (e) {
      return new Response("OAuth エラー:\n" + e.message, { status: 500 });
    }
  }
}

const discordAuthUrl =
  "https://discord.com/api/oauth2/authorize?client_id=" +
  CLIENT_ID +
  "&redirect_uri=" +
  encodeURIComponent(REDIRECT_URI) +
  "&response_type=code&scope=identify guilds.join";

return Response.redirect(discordAuthUrl, 302);
```

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

const res = await fetch("[https://discord.com/api/oauth2/token](https://discord.com/api/oauth2/token)", {
method: "POST",
headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: params.toString(),
});

if (res.ok) return res.json();
throw new Error("Discord APIエラー: " + res.status + " - " + (await res.text()));
}
