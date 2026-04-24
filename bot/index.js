import express from "express";
import fetch from "node-fetch";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();

// ===== 環境変数 =====
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;

// RenderのURLに変更する
const REDIRECT_URI = process.env.REDIRECT_URI;

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

    // ユーザー情報取得
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const user = await userRes.json();

    console.log("USER:", user);

    // 成功表示
    res.send("認証成功！戻ってOK");

  } catch (e) {
    console.error(e);
    res.status(500).send("error");
  }
});

// ===== 起動 =====
app.listen(3000, () => {
  console.log("Server running");
});
