import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { synthesize } from './tts.js';

const text = process.argv.slice(2).join(' ') || 'Hello! This is your Discord TTS bot. It works.';
const voice = process.env.TTS_VOICE || config.defaultVoice;

const { buffer, engine, ext } = await synthesize(text, voice);
const dir = path.resolve('test-output');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `sample-${engine}.${ext}`);
fs.writeFileSync(file, buffer);
console.log(`engine=${engine} bytes=${buffer.length} file=${file}`);
