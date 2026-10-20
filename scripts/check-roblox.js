import 'dotenv/config';

const token = (process.env.DISCORD_TOKEN ?? '').trim();
const API = 'https://discord.com/api/v10';
const headers = { Authorization: `Bot ${token}`, 'User-Agent': 'DiscordBot (https://localhost, 1.0)' };
const get = async (p) => {
  const r = await fetch(API + p, { headers });
  if (!r.ok) throw new Error(`${p} ${r.status}`);
  return r.json();
};

const VIEW = 1n << 10n, SEND = 1n << 11n, CONNECT = 1n << 20n, SPEAK = 1n << 21n;
const me = await get('/users/@me');
for (const g of await get('/users/@me/guilds')) {
  const [channels, roles, member] = await Promise.all([
    get(`/guilds/${g.id}/channels`),
    get(`/guilds/${g.id}/roles`),
    get(`/guilds/${g.id}/members/${me.id}`),
  ]);
  const roleMap = new Map(roles.map((r) => [r.id, r]));
  let base = 0n;
  for (const id of [g.id, ...member.roles]) {
    const role = roleMap.get(id);
    if (role) base |= BigInt(role.permissions);
  }
  for (const ch of channels.filter((c) => c.name.toLowerCase().includes('roblox'))) {
    let perms = base;
    const ow = ch.permission_overwrites ?? [];
    for (const o of ow.filter((x) => x.id === g.id || member.roles.includes(x.id) || x.id === me.id)) {
      perms = (perms & ~BigInt(o.deny)) | BigInt(o.allow);
    }
    console.log(`channel: ${ch.name} type=${ch.type} id=${ch.id}`);
    console.log(`  view=${(perms & VIEW) === VIEW} send=${(perms & SEND) === SEND} connect=${(perms & CONNECT) === CONNECT} speak=${(perms & SPEAK) === SPEAK}`);
    const msgs = await get(`/channels/${ch.id}/messages?limit=12`);
    for (const m of msgs.reverse()) {
      const reactions = (m.reactions ?? []).map((r) => `${r.emoji?.name}x${r.count}`).join(',');
      console.log(`  [${m.timestamp}] ${m.author.username}: ${JSON.stringify(m.content).slice(0, 100)} ${reactions ? `react:${reactions}` : ''}`);
    }
  }
}
console.log('now:', new Date().toISOString());
