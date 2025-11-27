export default {
  // すべてのリクエストはこの fetch 関数で処理される
  async fetch(request, env, ctx) {
    // 1. 環境変数（シークレットキーなど）を env オブジェクトから取得する
    // CLIENT_SECRETとBOT_TOKENはSecretsに、CLIENT_IDとREDIRECT_URIはVariablesに設定
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
            // 4. トークン取得成功！ (Bot連携の成功)
            
            // ユーザー情報を取得し、Bot連携を完了する処理はここに追加可能です。
            
            // 5. 連携完了画面を返す
            const successHtml = `
              <!DOCTYPE html>
              <html lang="ja">
              <body>
                  <h1>Discord 連携成功！🎉</h1>
                  <p>Bot とのアカウント連携が正常に完了しました。</p>
                  <p>これで Bot の全機能をご利用いただけます。</p>
              </body>
              </html>
            `;

            return new Response(successHtml, {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });

          } else {
            // トークン交換失敗
            return new Response("連携失敗: トークン交換エラー", { status: 500 });
          }
        } catch (error) {
          console.error('OAuth Error:', error);
          // エラーメッセージをユーザーに見せる（デバッグ用）
          return new Response(`連携処理中にエラーが発生しました: ${error.message}`, { status: 500 });
        }
      }
    }
    
    // 6. それ以外のパス（ルートパスなど）へのアクセス処理
    // ユーザーを Discord 認証ページへリダイレクトさせる
    
    // ⚠️ 修正箇所: REDIRECT_URI を encodeURIComponent でエンコードしています ⚠️
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join`; 
    
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
  params.append('scope', 'identify guilds.join'); // 認証時に要求したスコープと合わせる

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
