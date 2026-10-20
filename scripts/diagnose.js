import 'dotenv/config';

const token = (process.env.DISCORD_TOKEN ?? '').trim();
const API = 'https://discord.com/api/v10';
const headers = { Authorization: `Bot ${token}`, 'User-Agent': 'DiscordBot (https://localhost, 1.0)' };

const VIEW = 1n << 10n;
const SEND = 1n << 11n;
const HISTORY = 1n << 16n;
const CONNECT = 1n << 20n;
const SPEAK = 1n << 21n;

const TYPE_NAMES = {
  0: 'text', 2: 'voice', 4: 'category', 5: 'announcement', 13: 'stage', 15: 'forum',
};

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

function apply(perms, overwrite) {
  return (perms & ~BigInt(overwrite.deny)) | BigInt(overwrite.allow);
}

const me = await get('/users/@me');
console.log(`bot: ${me.username} (${me.id})`);

const guilds = await get('/users/@me/guilds');
for (const guild of guilds) {
  console.log(`\n=== ${guild.name} (${guild.id}) ===`);
  const [channels, roles, member] = await Promise.all([
    get(`/guilds/${guild.id}/channels`),
    get(`/guilds/${guild.id}/roles`),
    get(`/guilds/${guild.id}/members/${me.id}`),
  ]);

  const roleMap = new Map(roles.map((r) => [r.id, r]));
  let base = 0n;
  const everyone = roleMap.get(guild.id);
  if (everyone) base |= BigInt(everyone.permissions);
  for (const roleId of member.roles) {
    const role = roleMap.get(roleId);
    if (role) base |= BigInt(role.permissions);
  }

  for (const channel of channels.sort((a, b) => a.position - b.position)) {
    if (![0, 2, 5, 13, 15].includes(channel.type)) continue;
    let perms = base;
    const ow = channel.permission_overwrites ?? [];
    const everyoneOw = ow.find((o) => o.id === guild.id);
    if (everyoneOw) perms = apply(perms, everyoneOw);
    for (const roleId of member.roles) {
      const roleOw = ow.find((o) => o.id === roleId);
      if (roleOw) perms = apply(perms, roleOw);
    }
    const memberOw = ow.find((o) => o.id === me.id);
    if (memberOw) perms = apply(perms, memberOw);

    const canView = (perms & VIEW) === VIEW;
    const canSend = (perms & SEND) === SEND;
    const canHistory = (perms & HISTORY) === HISTORY;
    if (!canView) continue;

    let messages = [];
    try {
      messages = await get(`/channels/${channel.id}/messages?limit=50`);
    } catch {
      /* ignore */
    }
    const hits = messages.filter(
      (m) => m.author?.username === 'aniz_xd' || String(m.content ?? '').trim().startsWith('.'),
    );
    console.log(
      `#${channel.name} [${TYPE_NAMES[channel.type]}] view=${canView} send=${canSend} history=${canHistory} msgs=${messages.length}`,
    );
    for (const m of hits.slice(0, 8)) {
      console.log(`   ${m.author?.username}: ${String(m.content).slice(0, 120)}  (${m.timestamp})`);
    }
  }
}
