import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { synthesize } from './tts.js';

const text = process.argv.slice(2).join(' ').trim();
if (!text) {
  console.error('usage: npm run say -- "text to speak"');
  process.exit(1);
}

const { buffer, engine, ext } = await synthesize(text, config.defaultVoice);
const file = path.resolve('test-output', `say.${ext}`);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, buffer);
console.log(`engine=${engine} voice=${config.defaultVoice} rate=${config.rate} bytes=${buffer.length}`);

const script = [
  'Add-Type -AssemblyName PresentationCore',
  '$p = New-Object System.Windows.Media.MediaPlayer',
  `$p.Open([uri]'${file.replace(/'/g, "''")}')`,
  '$p.Play()',
  'Start-Sleep -Milliseconds 400',
  'while ($p.NaturalDuration.HasTimeSpan -and $p.Position -lt $p.NaturalDuration.TimeSpan) { Start-Sleep -Milliseconds 200 }',
  '$p.Close()',
].join('; ');

const player = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
  stdio: 'inherit',
  windowsHide: true,
});
player.on('close', (code) => process.exit(code ?? 0));
