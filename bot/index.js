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

// ===== Supabase保存 =====
async function saveUser(user) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: new Date().toISOString()
    })
  });

  console.log("Supabase:", res.status);
}

// ===== ロール付与 =====
async function giveRole(userId, accessToken) {
  await fetch(
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

// ===== JST変換関数 =====
function toJST(date) {
  return new Date(date).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo"
  });
}

// ===== 一覧ページ =====
app.get("/users", async (req, res) => {
  const dbRes = await fetch(
    SUPABASE_URL + "/rest/v1/users?select=*",
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  const users = await dbRes.json();

  const rows = users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${u.email}</td>
      <td>${toJST(u.created_at)}</td>
    </tr>
  `).join("");

  res.send(`
    <h2>ユーザー一覧（日本時間）</h2>
    <table border="1">
      <tr>
        <th>ID</th>
        <th>名前</th>
        <th>メール</th>
        <th>登録時間</th>
      </tr>
      ${rows}
    </table>
  `);
});

// ===== callback =====
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("No code");

  try {
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

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const user = await userRes.json();
    console.log("USER:", user);

    await saveUser(user);

    if (user.email && user.verified) {
      await giveRole(user.id, tokenData.access_token);
    }

    res.send(`
      <h2>認証成功</h2>
      <p>${user.username}</p>
      <p>${user.email}</p>
      <a href="/users">ユーザー一覧を見る</a>
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
