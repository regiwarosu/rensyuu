import { Client, GatewayIntentBits } from 'discord.js';
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

// 起動ログ
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// コマンド処理
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

// ログイン（最後に書く）
client.login(process.env.TOKEN);
