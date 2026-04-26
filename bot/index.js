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

const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;

// ===== Bot =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.login(BOT_TOKEN);

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== JST時間 =====
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

// ===== Supabase保存（IDで上書き）=====
async function saveUser(user) {
  const res = await fetch(
    SUPABASE_URL + "/rest/v1/users?on_conflict=id",
    {
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
        created_at: getJST()
      })
    }
  );

  console.log("Supabase:", res.status, await res.text());
}

// ===== サーバー参加（保険）=====
async function ensureJoin(userId, accessToken) {
  const res = await fetch(
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

  const text = await res.text();
  console.log("JOIN:", res.status, text);

  return res.status === 201 || res.status === 204;
}

// ===== ロール付与 =====
async function giveRole(userId) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${ROLE_ID}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`
      }
    }
  );

  const text = await res.text();
  console.log("ROLE:", res.status, text);

  return res.status;
}

// ===== callback =====
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect("https://discord.com/app");

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

    // DB保存
    await saveUser(user);

    // ロール処理
    if (user.email && user.verified) {
      let roleStatus = await giveRole(user.id);

      // 既存失敗なら joinして再試行
      if (roleStatus !== 204) {
        const joined = await ensureJoin(user.id, tokenData.access_token);

        if (joined) {
          await giveRole(user.id);
        }
      }
    }

  } catch (e) {
    console.error("ERROR:", e);
  }

  // 即戻す
  return res.redirect("https://discord.com/app");
});

// ===== 起動（Render対応）=====
app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
