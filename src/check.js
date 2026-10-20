import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Client, GatewayIntentBits, PermissionsBitField } from 'discord.js';
import ffmpegPath from 'ffmpeg-static';
import { config } from './config.js';
import { synthesize } from './tts.js';

if (ffmpegPath) process.env.FFMPEG_PATH = ffmpegPath;

const checks = [];
const add = (ok, label, detail = '') => checks.push({ ok, label, detail });

add(Number(process.versions.node.split('.')[0]) >= 20, 'Node.js >= 20', process.versions.node);
add(fs.existsSync(ffmpegPath ?? ''), 'ffmpeg binary', ffmpegPath ?? 'missing');
add(fs.existsSync('node_modules/opusscript'), 'opus encoder (opusscript)');
add(Boolean(config.token), 'DISCORD_TOKEN set', config.token ? `(${config.token.length} chars)` : 'missing');

let sampleEngine = null;
try {
  const { buffer, engine, ext } = await synthesize('TTS check. If you can hear this, the bot is ready.', config.defaultVoice);
  fs.mkdirSync('test-output', { recursive: true });
  const file = path.resolve('test-output', `check-${engine}.${ext}`);
  fs.writeFileSync(file, buffer);
  sampleEngine = engine;
  add(true, 'TTS engine', `${engine} -> ${file} (${buffer.length} bytes)`);
} catch (err) {
  add(false, 'TTS engine', err?.message ?? String(err));
}

if (config.token) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  try {
    await client.login(config.token);
    const invite = client.generateInvite({
      scopes: ['bot', 'applications.commands'],
      permissions: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.EmbedLinks,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AddReactions,
        PermissionsBitField.Flags.Connect,
        PermissionsBitField.Flags.Speak,
      ],
    });
    add(true, 'Discord login', `${client.user.tag} (${client.guilds.cache.size} guilds)`);
    console.log('\nInvite URL:\n' + invite + '\n');
  } catch (err) {
    add(false, 'Discord login', err.message);
  } finally {
    client.destroy();
  }
}

console.log('');
for (const check of checks) {
  console.log(`${check.ok ? 'OK  ' : 'FAIL'}  ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
}
if (sampleEngine) console.log(`\nSample written with the "${sampleEngine}" engine.`);

const failed = checks.filter((check) => !check.ok);
process.exit(failed.length ? 1 : 0);
