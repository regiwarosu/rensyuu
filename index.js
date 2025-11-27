// Worker のメインハンドラをエクスポートする形式
export default {
  // すべてのリクエストはこの fetch 関数で処理される
  async fetch(request, env, ctx) {
    // 1. 環境変数（シークレットキーなど）を env オブジェクトから取得する
    const CLIENT_ID = env.CLIENT_ID;
    const CLIENT_SECRET = env.CLIENT_SECRET;
    const REDIRECT_URI = env.REDIRECT_URI;
    const BOT_TOKEN = env.BOT_TOKEN; 

    const url = new URL(request.url);

    // 2. /callback パスへのアクセスを処理する (Discordからの応答)
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');

      if (code) {
        // --- 認可コードが存在する場合 ---
        
        try {
          // 3. 認可コードをアクセストークンに交換する (Discord API通信)
          const tokenData = await exchangeCodeForToken(code, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
          
          if (tokenData && tokenData.access_token) {
            // 4. トークン取得成功！
            
            // 🚨 修正前: 成功画面の代わりに、ルートパスへリダイレクト (302) 🚨
            // このコードは「連携成功！」のHTMLを返していた時の修正後の状態です。
            return Response.redirect(url.origin, 302); 

          } else {
            // トークン交換失敗（Discordがトークンを返さなかった）
            return new Response("連携失敗: トークン交換エラー", { status: 500 });
          }
        } catch (error) {
          console.error('OAuth Error:', error);
          // 🚨 修正前: エラーメッセージを表示する処理 🚨
          return new Response(`連携処理中にエラーが発生しました: ${error.message}`, { status: 500 });
        }
      }
    }
    
    // 5. それ以外のパス（ルートパスなど）へのアクセス処理
    // ユーザーを Discord 認証ページへリダイレクトさせる
    
    // REDIRECT_URI は encodeURIComponent でエンコードされています
    // 修正後: 文字列結合を使用
const discordAuthUrl = "https://discord.com/api/oauth2/authorize?client_id=" + CLIENT_ID + "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) + "&response_type=code&scope=identify%20guilds.join";
    // 認証ページへのリダイレクト
    return Response.redirect(discordAuthUrl, 302);
  },
};


// Discord APIと通信し、認可コードをアクセストークンに交換する関数
async function exchangeCodeForToken(code, client_id, client_secret, redirect_uri) {
  const params = new URLSearchParams();
  params.append('client_id', client_id);
  params.append('client_secret', client_secret);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', redirect_uri);
  params.append('scope', 'identify guilds.join');

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (response.ok) {
    return response.json();
  } else {
    const errorText = await response.text();
    // Discordからの詳細なエラーメッセージをスローする
    throw new Error(`Discord APIエラー: ${response.status} - ${errorText}`);
  }
}
