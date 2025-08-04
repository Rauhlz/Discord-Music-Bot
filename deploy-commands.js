const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder().setName('play').setDescription('Play a song from YouTube')
    .addStringOption(option => option.setName('url').setDescription('YouTube URL').setRequired(true)),
  new SlashCommandBuilder().setName('pause').setDescription('Pause the song'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume the song'),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
  new SlashCommandBuilder().setName('queue').setDescription('Show song queue'),
  new SlashCommandBuilder().setName('stop').setDescription('Stop playing and leave'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
