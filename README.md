# Discord TTS Bot

**Vox** — a prefix-triggered text-to-speech bot. Type `.hello everyone` in a server and the bot joins your voice channel and says it.

Built on Node.js + discord.js, with a three-engine TTS chain so it keeps working when one provider is down:

1. **Microsoft Edge neural voices** (best quality, free, no API key)
2. **Google Translate TTS** (free fallback)
3. **Windows SAPI** (offline, built into Windows â€” always available)

## Setup

1. **Create the Discord app** â€” <https://discord.com/developers/applications>
   - New Application â†’ **Bot** â†’ **Reset Token** â†’ copy the token.
   - Under **Bot â†’ Privileged Gateway Intents**, enable **Message Content Intent**.
2. **Add the token** â€” copy `.env.example` to `.env` and fill in `DISCORD_TOKEN=...`.
3. **Invite the bot** â€” open the invite URL printed by `npm start` (or `npm run check`). It asks for View Channels, Send Messages, Embed Links, Read Message History, Add Reactions, Connect and Speak.
4. **Run it**

   ```bash
   npm install
   npm start
   ```

   Verify everything first with:

   ```bash
   npm run check
   ```

## Commands

| Command | What it does |
|---|---|
| `.your message` | Speaks the message in your current voice channel |
| `.join` | Joins your voice channel |
| `.leave` | Leaves and clears the queue |
| `.stop` | Stops playback and clears the queue |
| `.skip` | Skips the current clip |
| `.voice aria` | Changes the voice (see `.voice list`) |
| `.voice en-US-JennyNeural` | Full voice name also works |
| `.help` | Shows the command list |

Responses are minimal on purpose: a ðŸ”Š reaction means the message was queued.

## Voices

`.voice list` shows aliases. The default is **`en-US-AvaMultilingualNeural`** â€” a conversational
multilingual voice that sounds much less like a flat read-aloud than the old `Aria` default.
`TTS_RATE=+8%` adds a little energy; set it to `+0%` if you want it slower.

Preview them all locally with:

```bash
npm run voices
```

That writes `test-output/voices/preview.html` â€” open it and click through the samples.

To hear any phrase immediately, without Discord:

```bash
npm run say -- "hello, this is a test"
```

This uses the same engine chain and plays through your speakers.

## Configuration (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `DISCORD_TOKEN` | â€” | Bot token (required) |
| `PREFIX` | `.` | Command prefix |
| `TTS_VOICE` | `en-US-AvaMultilingualNeural` | Default Edge voice |
| `TTS_RATE` | `+8%` | Speaking rate (`+0%` = Edge default) |
| `TTS_PITCH` | `+0Hz` | Pitch shift |
| `MAX_CHARS` | `300` | Longer messages are truncated before speaking |
| `SAPI_VOICE` | â€” | Offline voice name, e.g. `Microsoft Zira Desktop` |

## Troubleshooting

- **Bot is silent but joins** â€” check it has **Speak** in that channel; check the console for `[tts]` errors.
- **`429` / Edge errors** â€” Edge rate-limits by IP. The bot automatically falls back to Google and then to Windows SAPI; it also pauses Edge for 5 minutes after repeated failures.
- **`ffmpeg` errors** â€” `ffmpeg-static` ships the binary; run `npm install` again if `node_modules/ffmpeg-static/ffmpeg.exe` is missing.
- **Messages ignored** â€” **Message Content Intent** is not enabled, or the bot lacks View Channel / Read Message History.
- **No sound until someone talks** â€” Discord voice needs the bot to be connected; `.join` first if auto-join failed.

## Bot identity

The bot is **Vox**, with a waveform avatar at `assets/avatar.png`. Regenerate it with
`powershell -File assets/make-avatar.ps1`, then apply it to the bot via the Discord API
(`PATCH /users/@me` with a base64 data URI). The status is set in `src/index.js` on ready.

## Layout
```
src/
  index.js   Discord client, prefix commands, queue wiring
  player.js  Per-guild voice connection + audio player queue
  tts.js     Edge -> Google -> SAPI synthesis chain
  config.js  Env + voice aliases
  check.js   Doctor: deps, TTS sample, login, invite URL
  test-tts.js  Synthesize one phrase to test-output/
```
