import 'dotenv/config';
import {
  ActivityType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionsBitField,
} from 'discord.js';
import ffmpegPath from 'ffmpeg-static';
import { VOICES, config, resolveVoice } from './config.js';
import { prepareText } from './tts.js';
import { destroySession, findSession, getSession } from './player.js';

if (ffmpegPath) process.env.FFMPEG_PATH = ffmpegPath;

const REQUIRED_PERMISSIONS = [
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.EmbedLinks,
  PermissionsBitField.Flags.ReadMessageHistory,
  PermissionsBitField.Flags.AddReactions,
  PermissionsBitField.Flags.Connect,
  PermissionsBitField.Flags.Speak,
];

if (!config.token) {
  console.error(
    [
      'No Discord token found.',
      '',
      '1. Open https://discord.com/developers/applications',
      '2. New Application -> Bot -> Reset Token -> copy it',
      '3. Enable "Message Content Intent" under Bot -> Privileged Gateway Intents',
      '4. Put the token in .env as DISCORD_TOKEN=...',
      '5. Run: npm start',
    ].join('\n'),
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

function helpEmbed(client) {
  const voiceList = [...VOICES.keys()].join(', ');
  return new EmbedBuilder()
    .setTitle('Vox — text to speech')
    .setColor(0x7c3aed)
    .setThumbnail(client.user.displayAvatarURL({ size: 128 }))
    .setDescription(`Prefix: \`${config.prefix}\` — type \`${config.prefix}your message\` and I'll say it in your voice channel.`)
    .addFields(
      { name: 'Speak', value: `\`${config.prefix}hello everyone\`` },
      { name: 'Voice', value: `\`${config.prefix}voice aria\` — ${voiceList}\n\`${config.prefix}voice en-US-JennyNeural\`` },
      { name: 'Speed', value: `\`${config.prefix}rate -10%\` (slower) · \`${config.prefix}rate 0\` (normal)` },
      { name: 'Controls', value: `\`${config.prefix}join\` · \`${config.prefix}leave\` · \`${config.prefix}skip\` · \`${config.prefix}stop\` · \`${config.prefix}status\`` },
    )
    .setFooter({ text: 'Vox · .help for commands' });
}

async function ensureVoice(message) {
  const channel = message.member?.voice?.channel;
  if (!channel) {
    await message.reply('Join a voice channel first.').catch(() => {});
    return null;
  }

  const me = message.guild.members.me;
  const permissions = channel.permissionsFor(me);
  if (
    !permissions?.has(PermissionsBitField.Flags.Connect) ||
    !permissions?.has(PermissionsBitField.Flags.Speak)
  ) {
    await message.reply(`I need **Connect** and **Speak** in ${channel}.`).catch(() => {});
    return null;
  }

  return channel;
}

client.once(Events.ClientReady, async (ready) => {
  console.log(`Logged in as ${ready.user.tag} (${ready.guilds.cache.size} guilds)`);
  ready.user.setPresence({
    activities: [{ name: '.help · text to speech', type: ActivityType.Listening }],
    status: 'online',
  });
  console.log(
    'Invite URL:',
    ready.generateInvite({ scopes: ['bot', 'applications.commands'], permissions: REQUIRED_PERMISSIONS }),
  );
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild() || message.author.bot) return;
  if (!message.content.startsWith(config.prefix)) return;

  const body = message.content.slice(config.prefix.length).trim();
  if (!body) {
    await message.reply({ embeds: [helpEmbed(message.client)] }).catch(() => {});
    return;
  }

  const firstWord = body.split(/\s+/, 1)[0];
  const command = firstWord.toLowerCase();
  const rest = body.slice(firstWord.length).trim();

  switch (command) {
    case 'help': {
      await message.reply({ embeds: [helpEmbed(message.client)] }).catch(() => {});
      return;
    }

    case 'ping': {
      await message.reply(`Pong — ${Math.round(client.ws.ping)}ms`).catch(() => {});
      return;
    }

    case 'join': {
      const channel = await ensureVoice(message);
      if (!channel) return;
      try {
        await getSession(message.guild).connect(channel);
        await message.reply(`Joined ${channel}.`).catch(() => {});
      } catch (err) {
        await message.reply(`Could not join: ${err.message}`).catch(() => {});
      }
      return;
    }

    case 'leave': {
      destroySession(message.guild);
      await message.reply('Left the voice channel.').catch(() => {});
      return;
    }

    case 'stop': {
      findSession(message.guild)?.stop();
      await message.reply('Stopped.').catch(() => {});
      return;
    }

    case 'skip': {
      const skipped = findSession(message.guild)?.skip() ?? false;
      await message.reply(skipped ? 'Skipped.' : 'Nothing is playing.').catch(() => {});
      return;
    }

    case 'voice': {
      const session = getSession(message.guild);
      if (!rest || rest.toLowerCase() === 'list') {
        const list = [...VOICES.entries()].map(([alias, name]) => `\`${alias}\` → ${name}`).join('\n');
        await message.reply(`Voices:\n${list}\n\nCurrent: \`${session.voice ?? config.defaultVoice}\``).catch(() => {});
        return;
      }
      const resolved = resolveVoice(rest);
      if (!resolved) {
        await message.reply(`Unknown voice. Use \`${config.prefix}voice list\` or a full name like \`en-US-JennyNeural\`.`).catch(() => {});
        return;
      }
      session.voice = resolved;
      await message.reply(`Voice set to ${resolved}.`).catch(() => {});
      return;
    }

    case 'status': {
      const session = findSession(message.guild);
      const voice = session?.voice ?? config.defaultVoice;
      const engine = session?.lastEngine ?? 'nothing played yet';
      const connectedId = session?.connection?.joinConfig?.channelId;
      const connected = connectedId ? `<#${connectedId}>` : 'not connected';
      const queue = session?.queue.length ?? 0;
      await message
        .reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Vox — status')
              .setColor(0x22d3ee)
              .addFields(
                { name: 'Voice', value: `\`${voice}\``, inline: true },
                { name: 'Rate', value: `\`${session?.rate ?? config.rate}\``, inline: true },
                { name: 'Queue', value: `\`${queue}\``, inline: true },
                { name: 'Channel', value: connected, inline: true },
                { name: 'Last engine', value: `\`${engine}\``, inline: true },
              ),
          ],
        })
        .catch(() => {});
      return;
    }

    case 'rate': {
      const session = getSession(message.guild);
      if (!rest) {
        await message
          .reply(`Current speed: \`${session.rate ?? config.rate}\`. Use \`${config.prefix}rate -10%\` (range -50% to +50%).`)
          .catch(() => {});
        return;
      }
      const cleaned = rest.replace(/\s+/g, '');
      const match = cleaned.match(/^([+-]?\d{1,2})%?$/);
      if (!match) {
        await message
          .reply(`Usage: \`${config.prefix}rate -10%\` or \`${config.prefix}rate 0\` (range -50% to +50%).`)
          .catch(() => {});
        return;
      }
      const value = Number(match[1]);
      if (value < -50 || value > 50) {
        await message.reply('Pick a speed between `-50%` and `+50%`.').catch(() => {});
        return;
      }
      session.rate = `${value >= 0 ? '+' : ''}${value}%`;
      await message.reply(`Speed set to \`${session.rate}\` for this session.`).catch(() => {});
      return;
    }

    default:
      break;
  }

  const channel = await ensureVoice(message);
  if (!channel) return;

  const text = prepareText(body, message.mentions);
  if (!text || !/[a-z0-9]/i.test(text)) return;

  const clipped = text.length > config.maxChars ? `${text.slice(0, config.maxChars)}…` : text;

  try {
    const session = getSession(message.guild);
    await session.connect(channel);
    if (!session.voice) session.voice = config.defaultVoice;
    session.enqueue(clipped, {
      onError: (err) => {
        message.channel.send(`TTS failed: ${err?.message ?? 'unknown error'}`).catch(() => {});
      },
    });
    await message.react('🔊').catch(() => {});
  } catch (err) {
    await message.reply(`Could not speak: ${err.message}`).catch(() => {});
  }
});

client.on(Events.Error, (err) => {
  console.error('[discord]', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('[unhandled]', err);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  client.destroy();
  process.exit(0);
});

await client.login(config.token);
