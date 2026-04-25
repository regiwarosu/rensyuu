import express from "express";
import fetch from "node-fetch";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();

// ===== 環境変数 =====
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const REDIRECT_URI = process.env.REDIRECT_URI;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// ===== Discord設定 =====
const GUILD_ID = "あなたのサーバーID";
const ROLE_ID = "付与したいロールID";

// ===== Discord Bot =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.login(BOT_TOKEN);

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== JST時間取得 =====
function getJST() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Tokyo"
  }).replace(" ", "T");
}

// ===== OAuth開始 =====
app.get("/", (req, res) => {
  const url =
    "https://discord.com/api/oauth2/authorize" +
    "?client_id=" + CLIENT_ID +
    "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
    "&response_type=code" +
    "&scope=" + encodeURIComponent("identify email guilds.join") +
    "&prompt=consent";

  res.redirect(url);
});

// ===== Supabase保存（email基準）=====
async function saveUser(user) {
  console.log("保存開始");

  const res = await fetch(SUPABASE_URL + "/rest/v1/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      email: user.email,
      id: user.id,
      username: user.username,
      created_at: getJST() // ← JSTで保存
    })
  });

  console.log("Supabase:", res.status);
}

// ===== ロール付与 =====
async function giveRole(userId, accessToken) {
  const joinRes = await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        access_token: accessToken
      })
    }
  );

  console.log("Guild join:", joinRes.status);

  const roleRes = await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${ROLE_ID}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`
      }
    }
  );

  console.log("Role:", roleRes.status);
}

// ===== callback =====
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("No code");

  try {
    // トークン取得
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenRes.json();

    // ユーザー取得
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const user = await userRes.json();
    console.log("USER:", user);

    // 保存
    await saveUser(user);

    // email確認 → ロール付与
    if (user.email && user.verified) {
      await giveRole(user.id, tokenData.access_token);
    }

    // ===== Discordに戻す =====
    res.send(`
<!DOCTYPE html>
<html>
  <body>
    <p>認証完了！Discordに戻ります...</p>
    <script>
      window.open("discord://", "_self");

      setTimeout(() => {
        window.location.href = "https://discord.com/app";
      }, 1500);

      setTimeout(() => {
        window.close();
      }, 2000);
    </script>
  </body>
</html>
`);

  } catch (e) {
    console.error(e);
    res.status(500).send("error");
  }
});

// ===== 起動 =====
app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
