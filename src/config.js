import 'dotenv/config';

export const config = {
  token: (process.env.DISCORD_TOKEN ?? '').trim(),
  prefix: process.env.PREFIX || '.',
  defaultVoice: process.env.TTS_VOICE || 'en-US-AvaMultilingualNeural',
  rate: process.env.TTS_RATE || '+8%',
  pitch: process.env.TTS_PITCH || '+0Hz',
  maxChars: Number(process.env.MAX_CHARS) || 300,
  sapiVoice: process.env.SAPI_VOICE || '',
};

export const VOICES = new Map([
  ['prabhat', 'en-IN-PrabhatNeural'],
  ['neerja', 'en-IN-NeerjaNeural'],
  ['neerja-expressive', 'en-IN-NeerjaExpressiveNeural'],
  ['madhur', 'hi-IN-MadhurNeural'],
  ['swara', 'hi-IN-SwaraNeural'],
  ['ava', 'en-US-AvaMultilingualNeural'],
  ['emma', 'en-US-EmmaMultilingualNeural'],
  ['andrew', 'en-US-AndrewMultilingualNeural'],
  ['brian', 'en-US-BrianMultilingualNeural'],
  ['aria', 'en-US-AriaNeural'],
  ['jenny', 'en-US-JennyNeural'],
  ['guy', 'en-US-GuyNeural'],
  ['christopher', 'en-US-ChristopherNeural'],
  ['eric', 'en-US-EricNeural'],
  ['michelle', 'en-US-MichelleNeural'],
  ['roger', 'en-US-RogerNeural'],
  ['steffan', 'en-US-SteffanNeural'],
  ['sonia', 'en-GB-SoniaNeural'],
  ['ryan', 'en-GB-RyanNeural'],
  ['natasha', 'en-AU-NatashaNeural'],
  ['william', 'en-AU-WilliamMultilingualNeural'],
]);

export function resolveVoice(input) {
  const raw = input.trim();
  if (!raw) return null;
  const alias = VOICES.get(raw.toLowerCase());
  if (alias) return alias;
  if (/^[a-z]{2,3}-[A-Za-z]{2,4}-[A-Za-z]+Neural$/.test(raw)) return raw;
  return null;
}
