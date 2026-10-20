import { MsEdgeTTS } from 'msedge-tts';

const tts = new MsEdgeTTS();
const voices = await tts.getVoices();
const wanted = voices.filter((v) => /^en-(US|GB|AU)-/.test(v.ShortName));
console.log('total voices:', voices.length);
console.log('english voices:', wanted.length);
for (const v of wanted) {
  console.log(`${v.ShortName}\t${v.Gender}\t${v.Locale}`);
}
tts.close();
