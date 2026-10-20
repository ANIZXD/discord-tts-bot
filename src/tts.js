import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { config } from './config.js';

const EDGE_TIMEOUT_MS = 20_000;
const EDGE_COOLDOWN_MS = 60_000;
const GOOGLE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const edgeState = { failures: 0, cooldownUntil: 0 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Turns raw Discord message text into something that sounds right when read aloud. */
export function prepareText(raw, mentions) {
  let text = String(raw ?? '');
  text = text.replace(/<a?:(\w+):\d+>/g, '$1');
  text = text.replace(/<@!?(\d+)>/g, (_, id) => `@${mentions?.users?.get(id)?.displayName ?? 'someone'}`);
  text = text.replace(/<#(\d+)>/g, (_, id) => `#${mentions?.channels?.get(id)?.name ?? 'channel'}`);
  text = text.replace(/<@&(\d+)>/g, (_, id) => `@${mentions?.roles?.get(id)?.name ?? 'role'}`);
  text = text.replace(/https?:\/\/\S+/gi, 'link');
  text = text.replace(/[*_~`>|]/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function chunkText(text, max = 190) {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut < max * 0.4) cut = max;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function edgeOnce(text, voice, rate = config.rate) {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 15_000, synthesisTimeoutMs: EDGE_TIMEOUT_MS });
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(text), {
      rate,
      pitch: config.pitch,
    });
    const chunks = [];
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Edge TTS timed out')), EDGE_TIMEOUT_MS);
      audioStream.on('data', (chunk) => chunks.push(chunk));
      audioStream.once('end', () => {
        clearTimeout(timer);
        resolve();
      });
      audioStream.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    if (chunks.length === 0) throw new Error('Edge TTS returned no audio');
    return Buffer.concat(chunks);
  } finally {
    try {
      tts.close();
    } catch {
      /* ignore */
    }
  }
}

async function googleOnce(text, lang = 'en') {
  const url = new URL('https://translate.google.com/translate_tts');
  url.searchParams.set('ie', 'UTF-8');
  url.searchParams.set('q', text);
  url.searchParams.set('tl', lang);
  url.searchParams.set('client', 'tw-ob');
  const res = await fetch(url, {
    headers: { 'User-Agent': GOOGLE_UA, Referer: 'https://translate.google.com/' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 500) throw new Error('Google TTS returned no audio');
  return buffer;
}

async function googleTts(text) {
  const parts = chunkText(text, 190);
  const buffers = [];
  for (const part of parts) buffers.push(await googleOnce(part));
  return Buffer.concat(buffers);
}

function sapiTts(text, voice) {
  const base = path.join(os.tmpdir(), `discord-tts-${randomUUID()}`);
  const txtFile = `${base}.txt`;
  const wavFile = `${base}.wav`;
  fs.writeFileSync(txtFile, text, 'utf8');

  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    'if ($env:TTS_SAPI_VOICE) { try { $s.SelectVoice($env:TTS_SAPI_VOICE) } catch {} }',
    '$s.SetOutputToWaveFile($env:TTS_WAV)',
    '$s.Speak([System.IO.File]::ReadAllText($env:TTS_TXT, [System.Text.Encoding]::UTF8))',
    '$s.Dispose()',
  ].join('; ');

  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        env: { ...process.env, TTS_TXT: txtFile, TTS_WAV: wavFile, TTS_SAPI_VOICE: voice || '' },
        windowsHide: true,
      },
    );
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', (err) => {
      remove(txtFile);
      remove(wavFile);
      reject(err);
    });
    child.on('close', (code) => {
      remove(txtFile);
      try {
        if (code !== 0) throw new Error(`Windows SAPI failed (${code}): ${stderr.slice(-300)}`);
        const buffer = fs.readFileSync(wavFile);
        resolve(buffer);
      } catch (err) {
        reject(err);
      } finally {
        remove(wavFile);
      }
    });

    function remove(file) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
  });
}

/**
 * Synthesizes text with automatic fallback:
 * Edge neural voices -> Google Translate TTS -> offline Windows SAPI.
 * Returns { buffer, ext, engine }.
 */
export async function synthesize(text, voice, rate = config.rate) {
  const clean = text.trim();
  if (!clean) throw new Error('Nothing to say');

  const errors = [];

  if (Date.now() >= edgeState.cooldownUntil) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const buffer = await edgeOnce(clean, voice, rate);
        edgeState.failures = 0;
        return { buffer, ext: 'mp3', engine: 'edge' };
      } catch (err) {
        errors.push(err);
        const message = String(err?.message ?? err);
        console.warn(`[tts] edge attempt ${attempt + 1} failed: ${message.slice(0, 120)}`);
        if (message.includes('429')) break;
        if (attempt < 2) await sleep(1200 * (attempt + 1));
      }
    }
    edgeState.failures += 1;
    if (edgeState.failures >= 3) edgeState.cooldownUntil = Date.now() + EDGE_COOLDOWN_MS;
  }

  try {
    return { buffer: await googleTts(clean), ext: 'mp3', engine: 'google' };
  } catch (err) {
    console.warn(`[tts] google failed: ${String(err?.message ?? err).slice(0, 120)}`);
    errors.push(err);
  }

  try {
    return { buffer: await sapiTts(clean, voice), ext: 'wav', engine: 'sapi' };
  } catch (err) {
    console.warn(`[tts] sapi failed: ${String(err?.message ?? err).slice(0, 120)}`);
    errors.push(err);
  }

  throw new AggregateError(errors, 'All TTS engines failed');
}
