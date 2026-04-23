import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fetch from 'node-fetch';
import express from 'express';

// ===== サーバー（Render用）=====
const app = express();
app.get('/', (req, res) => {
  res.send('Bot is running');
});
app.listen(3000);

// ===== Discord Bot =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== 一回だけ送る用 =====
let messageId = "1496427186339446936"; // ← 最初は空

// ===== 起動時 =====
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch("1496426026715058226");
  try {
    if (messageId) {
      await channel.messages.fetch(messageId);
      console.log("既にあるから送らない");
      return;
    }
  } catch {}

  const button = new ButtonBuilder()
    .setLabel("認証する")
    .setStyle(ButtonStyle.Link)
    .setURL("https://3domenosyoujiki.hnks.workers.dev/");

  const row = new ActionRowBuilder().addComponents(button);

  const msg = await channel.send({
    content: "下のボタンを押して認証してください",
    components: [row]
  });

  console.log("このIDを保存:", msg.id);
});

// ===== コマンド処理 =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'test') {
    await interaction.deferReply();

    try {
      const res = await fetch(
        "https://3domenosyoujiki.hnks.workers.dev/refresh/" + interaction.user.id
      );

      const text = await res.text();

      await interaction.editReply("送信結果:\n" + text);
    } catch (e) {
      await interaction.editReply("エラー:\n" + e.message);
    }
  }
});

// ===== ログイン =====
client.login(process.env.TOKEN);
