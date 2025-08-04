require('dotenv').config(); // Loads .env variables

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  getVoiceConnection,
} = require('@discordjs/voice');
const play = require('play-dl');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Queue Map to hold guild queues
const queue = new Map();

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const serverQueue = queue.get(message.guild.id);

  if (command === 'play') {
    const url = args[0];
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) return message.reply('🔊 You need to be in a voice channel to play music!');
    if (!url || !play.yt_validate(url)) return message.reply('❗ Please provide a valid YouTube URL.');

    let songInfo;
    try {
      songInfo = await play.video_basic_info(url);
    } catch {
      return message.reply('❌ Failed to get video info.');
    }

    const song = {
      title: songInfo.video_details.title,
      url: songInfo.video_details.url,
    };

    if (!serverQueue) {
      const queueContruct = {
        voiceChannel,
        connection: null,
        player: null,
        songs: [],
        playing: true,
      };

      queue.set(message.guild.id, queueContruct);

      queueContruct.songs.push(song);

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });

        queueContruct.connection = connection;
        const player = createAudioPlayer({
          behaviors: {
            noSubscriber: NoSubscriberBehavior.Pause,
          },
        });

        queueContruct.player = player;
        connection.subscribe(player);

        playSong(message.guild.id, queueContruct.songs[0]);

        message.channel.send(`🎶 Now playing: **${song.title}**`);
      } catch (err) {
        console.error(err);
        queue.delete(message.guild.id);
        return message.reply('❌ Error connecting to voice channel.');
      }
    } else {
      serverQueue.songs.push(song);
      message.channel.send(`➕ Added to queue: **${song.title}**`);
    }
  }

  else if (command === 'skip') {
    if (!serverQueue) return message.reply('🚫 No song is currently playing.');
    serverQueue.player.stop();
    message.channel.send('⏭️ Skipped the current song.');
  }

  else if (command === 'pause') {
    if (!serverQueue || !serverQueue.playing) return message.reply('⏸️ No song is currently playing.');
    serverQueue.player.pause();
    serverQueue.playing = false;
    message.channel.send('⏸️ Playback paused.');
  }

  else if (command === 'resume') {
    if (!serverQueue || serverQueue.playing) return message.reply('▶️ Playback is already ongoing.');
    serverQueue.player.unpause();
    serverQueue.playing = true;
    message.channel.send('▶️ Playback resumed.');
  }

  else if (command === 'queue') {
    if (!serverQueue) return message.reply('🚫 No songs in the queue.');
    const songList = serverQueue.songs.map((song, index) => `${index + 1}. ${song.title}`).join('\n');
    message.channel.send(`📜 Current Queue:\n${songList}`);
  }

  else if (command === 'stop') {
    if (!serverQueue) return message.reply('🚫 No music is playing.');
    serverQueue.songs = [];
    serverQueue.player.stop();
    serverQueue.connection.destroy();
    queue.delete(message.guild.id);
    message.channel.send('🛑 Stopped playback and left the voice channel.');
  }
});

async function playSong(guildId, song) {
  const serverQueue = queue.get(guildId);

  if (!song) {
    serverQueue.connection.destroy();
    queue.delete(guildId);
    return;
  }

  let stream;
  try {
    stream = await play.stream(song.url);
  } catch (error) {
    console.error(error);
    serverQueue.songs.shift();
    playSong(guildId, serverQueue.songs[0]);
    return;
  }

  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
  });

  serverQueue.player.play(resource);
  serverQueue.playing = true;

  serverQueue.player.once(AudioPlayerStatus.Idle, () => {
    serverQueue.songs.shift();
    playSong(guildId, serverQueue.songs[0]);
  });
}

client.login(process.env.BOT_TOKEN);
