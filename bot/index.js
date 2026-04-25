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
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: new Date().toISOString()
    })
  });

  const text = await res.text();

  console.log("Supabase status:", res.status);
  console.log("Supabase response:", text);

  if (!res.ok) {
    throw new Error("Supabaseエラー: " + text);
  }
}

// ===== callback =====
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) return res.send("No code");

  try {
    console.log("CODE:", code);

    // ===== トークン取得 =====
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
    console.log("TOKEN:", tokenData);

    // ===== ユーザー取得 =====
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const user = await userRes.json();
    console.log("USER:", user);

    // ===== 保存 =====
    await saveUser(user);

    // ===== 成功画面 =====
    res.send(`
      <h2>認証成功</h2>
      <p>${user.username}</p>
      <p>${user.email || "email非公開"}</p>
    `);

  } catch (e) {
    console.error("ERROR:", e);
    res.status(500).send("ERROR: " + e.message);
  }
});

// ===== サーバー起動 =====
app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
