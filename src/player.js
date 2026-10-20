import { Readable } from 'node:stream';
import {
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice';
import { synthesize } from './tts.js';
import { config } from './config.js';

const sessions = new Map();

class Session {
  constructor(guild) {
    this.guild = guild;
    this.queue = [];
    this.voice = null;
    this.rate = null;
    this.connection = null;
    this.channelId = null;
    this.current = null;
    this.busy = false;
    this.lastEngine = null;
    this.player = createAudioPlayer();

    this.player.on(AudioPlayerStatus.Idle, () => {
      if (!this.current) return;
      this.current = null;
      this.busy = false;
      void this.#pump();
    });
    this.player.on('error', (err) => {
      console.error(`[player:${guild.id}] ${err.message}`);
      if (!this.current) return;
      this.current = null;
      this.busy = false;
      void this.#pump();
    });
    this.player.on('stateChange', (oldState, newState) => {
      console.log(`[player:${guild.id}] ${oldState.status} -> ${newState.status}`);
    });
  }

  enqueue(text, { onError } = {}) {
    this.queue.push({ text, onError });
    void this.#pump();
  }

  async #pump() {
    if (this.busy) return;
    const item = this.queue.shift();
    if (!item) return;
    this.busy = true;
    try {
      const { buffer, engine } = await synthesize(item.text, this.voice, this.rate ?? config.rate);
      this.lastEngine = engine;
      console.log(`[tts:${this.guild.id}] engine=${engine} voice=${this.voice} rate=${this.rate ?? config.rate} chars=${item.text.length}`);
      const resource = createAudioResource(Readable.from(buffer), { inputType: StreamType.Arbitrary });
      this.current = resource;
      this.player.play(resource);
      setTimeout(() => {
        if (this.current !== resource) return;
        const state = this.player.state;
        if (state.status === AudioPlayerStatus.Playing && state.playbackDuration < 500) {
          console.warn(`[player:${this.guild.id}] playback never started, skipping`);
          this.player.stop(true);
        }
      }, 12_000);
    } catch (err) {
      console.error(`[tts:${this.guild.id}] ${err?.message ?? err}`);
      this.busy = false;
      this.current = null;
      item.onError?.(err);
      void this.#pump();
    }
  }

  async connect(channel) {
    if (
      this.connection &&
      this.channelId === channel.id &&
      this.connection.state.status !== VoiceConnectionStatus.Destroyed
    ) {
      return this.connection;
    }

    if (this.connection) this.connection.destroy();

    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    this.channelId = channel.id;
    this.connection.subscribe(this.player);

    this.connection.on('stateChange', (_, next) => {
      console.log(`[voice:${this.guild.id}] ${next.status}`);
    });
    this.connection.on('error', (err) => {
      console.error(`[voice:${this.guild.id}] ${err.message}`);
    });
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });

    return this.connection;
  }

  stop() {
    this.queue.length = 0;
    this.player.stop(true);
    this.current = null;
    this.busy = false;
  }

  skip() {
    if (!this.current) return false;
    this.player.stop(true);
    return true;
  }

  destroy() {
    this.stop();
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
    this.channelId = null;
    sessions.delete(this.guild.id);
  }
}

export function getSession(guild) {
  let session = sessions.get(guild.id);
  if (!session) {
    session = new Session(guild);
    sessions.set(guild.id, session);
  }
  return session;
}

export function findSession(guild) {
  return sessions.get(guild.id) ?? null;
}

export function destroySession(guild) {
  sessions.get(guild.id)?.destroy();
}
