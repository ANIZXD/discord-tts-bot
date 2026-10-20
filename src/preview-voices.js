import fs from 'node:fs';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { escapeXml } from './tts.js';

const TEXT =
  "Hey, kya kar rahe ho? I'm your Discord voice bot. Type a message and I'll say it out loud. Pretty cool, right?";

const VARIANTS = [
  ['prabhat', 'en-IN-PrabhatNeural', '+5%'],
  ['neerja', 'en-IN-NeerjaNeural', null],
  ['neerja-expressive', 'en-IN-NeerjaExpressiveNeural', null],
  ['madhur', 'hi-IN-MadhurNeural', null],
  ['swara', 'hi-IN-SwaraNeural', null],
  ['ava-lively', 'en-US-AvaMultilingualNeural', '+8%'],
];

const dir = path.resolve('test-output/voices');
fs.mkdirSync(dir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function render(label, voice, rate) {
  const file = path.join(dir, `${label}.mp3`);
  for (let attempt = 1; attempt <= 4; attempt++) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(escapeXml(TEXT), rate ? { rate } : undefined);
      const chunks = [];
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 25000);
        audioStream.on('data', (c) => chunks.push(c));
        audioStream.once('end', () => { clearTimeout(timer); resolve(); });
        audioStream.once('error', (err) => { clearTimeout(timer); reject(err); });
      });
      const buffer = Buffer.concat(chunks);
      if (buffer.length < 3000) throw new Error('too small');
      fs.writeFileSync(file, buffer);
      console.log(`${label.padEnd(12)} ${voice.padEnd(34)} ${buffer.length} bytes`);
      return;
    } catch (err) {
      const msg = String(err?.message ?? err);
      console.log(`${label} attempt ${attempt} failed: ${msg.slice(0, 90)}`);
      if (attempt === 4) throw err;
      await sleep(4000);
    } finally {
      try { tts.close(); } catch { /* ignore */ }
    }
  }
}

for (const [label, voice, rate] of VARIANTS) {
  await render(label, voice, rate);
  await sleep(700);
}

const cards = VARIANTS.map(([label, voice, rate]) => `
    <div class="card">
      <div class="meta"><strong>${label}</strong><span>${voice}${rate ? ` · rate ${rate}` : ''}</span></div>
      <audio controls preload="none" src="./${label}.mp3"></audio>
    </div>`).join('');

fs.writeFileSync(
  path.join(dir, 'preview.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Discord TTS voice preview</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 32px; background: #111214; color: #e6e7ea;
         font-family: ui-sans-serif, "Segoe UI", system-ui, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { color: #9aa0a6; margin: 0 0 24px; font-size: 14px; }
  .grid { display: grid; gap: 12px; max-width: 760px; }
  .card { background: #1a1b1e; border: 1px solid #2a2c30; border-radius: 12px;
          padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .meta { display: flex; flex-direction: column; gap: 2px; }
  .meta strong { font-size: 14px; }
  .meta span { color: #8b9098; font-size: 12px; }
  audio { height: 34px; }
</style>
</head>
<body>
  <h1>Pick a voice</h1>
  <p>Same sentence, different voices. Tell me which one sounds right.</p>
  <div class="grid">${cards}
  </div>
</body>
</html>`,
);

console.log('\npreview:', path.join(dir, 'preview.html'));
