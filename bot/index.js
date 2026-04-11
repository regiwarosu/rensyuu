client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'test') {
    await interaction.deferReply(); // ←これ重要！！！

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
