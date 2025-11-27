export default {
async fetch(request, env, ctx) {
const CLIENT_ID = env.CLIENT_ID;
const CLIENT_SECRET = env.CLIENT_SECRET;
const REDIRECT_URI = env.REDIRECT_URI;
const BOT_TOKEN = env.BOT_TOKEN;
const url = new URL(request.url);

// ====== callback処理 ======
if (url.pathname === '/callback') {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // ★戻り先URL

  if (code) {
    try {
      const tokenData = await exchangeCodeForToken(
        code,
        CLIENT_ID,
        CLIENT_SECRET,
        REDIRECT_URI
      );

      if (tokenData && tokenData.access_token) {
        // ★ 認証成功 → state のページへ戻す
        return Response.redirect(state || "/", 302);
      } else {
        return new Response("連携失敗: トークン交換エラー", { status: 500 });
      }
    } catch (error) {
      console.error("OAuth Error:", error);
      return new Response(
        `連携処理中にエラーが発生しました: ${error.message}`,
        { status: 500 }
      );
    }
  }
}

// ====== 認証開始（Discordへリダイレクト） ======
// ★元のページURL（戻る先）
const originalUrl = request.url;

const discordAuthUrl =
  `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code&scope=identify%20guilds.join` +
  `&state=${encodeURIComponent(originalUrl)}`; // ★戻り先情報を付ける

return Response.redirect(discordAuthUrl, 302);
},
};
// ====== 認可コード → アクセストークン変換 ======
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
if (response.ok) {
return response.json();
} else {
const errorText = await response.text();
throw new Error(Discord APIエラー: ${response.status} - ${errorText});
}
}
