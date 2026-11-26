const {
  Client, GatewayIntentBits, Partials, Events
} = require('discord.js');
const config = require('./config');
const db = require('./db');
const eco = require('./economy');
const drops = require('./drops');
const dungeons = require('./dungeons');
const { commands, replies } = require('./commands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ---------- Voice tracking ----------
const voiceSessions = new Map(); // userId -> { start, claimed30, claimed60 }

function voiceKey(u) {
  const key = new Date().toDateString();
  if (u.voice.day !== key) {
    u.voice.day = key;
    u.voice.claimed30 = false;
    u.voice.claimed60 = false;
    u.voice.seconds = 0;
  }
  return u;
}

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;
  const id = member.id;

  if (!oldState.channelId && newState.channelId) {
    voiceSessions.set(id, { start: Date.now(), claimed30: false, claimed60: false });
  } else if (oldState.channelId && !newState.channelId) {
    const s = voiceSessions.get(id);
    if (s) {
      const u = voiceKey(eco.get(id));
      u.voice.seconds += Math.floor((Date.now() - s.start) / 1000);
      eco.save(u);
      voiceSessions.delete(id);
    }
  } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const s = voiceSessions.get(id);
    if (s) {
      const u = voiceKey(eco.get(id));
      u.voice.seconds += Math.floor((Date.now() - s.start) / 1000);
      eco.save(u);
    }
    voiceSessions.set(id, { start: Date.now(), claimed30: false, claimed60: false });
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of voiceSessions.entries()) {
    const mins = (now - s.start) / 60000;
    if (mins >= 30 && !s.claimed30) {
      s.claimed30 = true;
      eco.addCash(id, config.voice30, 'voice', '30 min in voice');
    }
    if (mins >= 60 && !s.claimed60) {
      s.claimed60 = true;
      eco.addCash(id, config.voice60, 'voice', '60 min in voice');
    }
  }
}, 30000).unref();

// ---------- Commands & drop codes ----------
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // Drop code claims happen first so a code is never treated as a command.
  const claimed = await drops.handleMessage(message);
  if (claimed) return;

  const content = message.content.trim();
  if (!content.startsWith(config.prefix)) return;

  const body = content.slice(config.prefix.length).trim();
  if (!body) return;
  const parts = body.split(/\s+/);
  const name = parts.shift().toLowerCase();
  const args = parts;

  const cmd = commands[name];
  if (!cmd) return;

  try {
    await cmd(message, args);
  } catch (err) {
    console.error(`Command ${name} failed:`, err);
    replies.err(message, 'Something went wrong running that command.');
  }
});

// ---------- Dungeon buttons ----------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId.startsWith('dg_')) {
    try { await dungeons.handle(interaction); }
    catch (err) {
      console.error('Dungeon button failed:', err);
      await interaction.reply({ content: 'Dungeon action failed.', ephemeral: true }).catch(() => {});
    }
  }
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  drops.setNotifier(async (embed, type, channelName) => {
    for (const id of db.allUsers()) {
      if (!eco.get(id).notify) continue;
      const user = await client.users.fetch(id).catch(() => null);
      if (!user) continue;
      await user.send({
        content: `⚡ A ${type} drop just appeared in **#${channelName}** — go claim it!`,
        embeds: [embed]
      }).catch(() => {});
    }
  });
  drops.start(client);
});

if (!config.token) {
  console.error('DISCORD_TOKEN is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}
client.login(config.token);
