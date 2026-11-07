import 'dotenv/config';

export const config = {
  token: (process.env.DISCORD_TOKEN ?? '').trim(),
  prefix: process.env.PREFIX || '.',
  defaultVoice: process.env.TTS_VOICE || 'en-US-AvaMultilingualNeural',
  rate: process.env.TTS_RATE || '+0%',
  pitch: process.env.TTS_PITCH || '+0Hz',
  maxChars: Number(process.env.MAX_CHARS) || 300,
  sapiVoice: process.env.SAPI_VOICE || '',
};

export const VOICES = new Map([
  ['ava', 'en-US-AvaMultilingualNeural'],
  ['ava-realistic', 'en-US-AvaMultilingualNeural'],
  ['lively', 'en-US-EmmaMultilingualNeural'],
]);

export function resolveVoice(input) {
  const raw = input.trim();
  if (!raw) return null;
  const alias = VOICES.get(raw.toLowerCase());
  if (alias) return alias;
  if (/^[a-z]{2,3}-[A-Za-z]{2,4}-[A-Za-z]+Neural$/.test(raw)) return raw;
  return null;
}
