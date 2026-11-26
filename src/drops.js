const config = require('./config');
const db = require('./db');
const eco = require('./economy');
const { randInt, pick, baseEmbed, money } = require('./utils');

// Replace this with any pirate GIF/image URL you like.
const PIRATE_GIF = 'https://i.pinimg.com/originals/88/1a/98/881a988f92d5a2d602e881f8d4f699f7.gif';

// Random countries for the flag event. Players type .<country name> (or .flag <name>).
const COUNTRIES = [
  { code: 'us', flag: '🇺🇸', names: ['united states', 'united state', 'united states of america', 'usa', 'us', 'america'] },
  { code: 'gb', flag: '🇬🇧', names: ['united kingdom', 'uk', 'britain', 'england'] },
  { code: 'fr', flag: '🇫🇷', names: ['france'] },
  { code: 'de', flag: '🇩🇪', names: ['germany'] },
  { code: 'it', flag: '🇮🇹', names: ['italy'] },
  { code: 'es', flag: '🇪🇸', names: ['spain'] },
  { code: 'jp', flag: '🇯🇵', names: ['japan'] },
  { code: 'kr', flag: '🇰🇷', names: ['south korea', 'korea'] },
  { code: 'cn', flag: '🇨🇳', names: ['china'] },
  { code: 'in', flag: '🇮🇳', names: ['india'] },
  { code: 'br', flag: '🇧🇷', names: ['brazil'] },
  { code: 'ca', flag: '🇨🇦', names: ['canada'] },
  { code: 'au', flag: '🇦🇺', names: ['australia'] },
  { code: 'mx', flag: '🇲🇽', names: ['mexico'] },
  { code: 'ru', flag: '🇷🇺', names: ['russia'] },
  { code: 'za', flag: '🇿🇦', names: ['south africa'] },
  { code: 'se', flag: '🇸🇪', names: ['sweden'] },
  { code: 'th', flag: '🇹🇭', names: ['thailand'] },
  { code: 'tr', flag: '🇹🇷', names: ['turkey'] },
  { code: 'ng', flag: '🇳🇬', names: ['nigeria'] }
];

const flagImage = c => `https://flagcdn.com/w320/${c.code}.png`;

function pirateCode() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const chars = [
    pick(upper.split('')), pick(lower.split('')), pick(digits.split('')),
    pick((upper + lower + digits).split(''))
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

let client = null;
let activeDrop = null;
let nextTimer = null;
let expireTimer = null;
let nextType = 'pirate';
let notifier = null;

function setNotifier(fn) { notifier = fn; }

function resetAllStreaks() {
  for (const id of db.allUsers()) {
    const u = eco.get(id);
    const s = u.stats;
    if (s.streak || s.streakTotal || s.flagStreak || s.flagStreakTotal || s.boxStreak || s.boxStreakTotal) {
      s.streak = 0; s.streakTotal = 0;
      s.flagStreak = 0; s.flagStreakTotal = 0;
      s.boxStreak = 0; s.boxStreakTotal = 0;
      eco.save(u);
    }
  }
}

function scheduleNext() {
  if (nextTimer) clearTimeout(nextTimer);
  const delay = randInt(config.dropMinDelay, config.dropMaxDelay);
  console.log(`[drops] Next drop in ${Math.round(delay / 1000)}s`);
  nextTimer = setTimeout(triggerDrop, delay);
}

async function triggerDrop() {
  if (activeDrop) return scheduleNext();
  const channel = await client.channels.fetch(config.generalChannelId).catch(e => {
    console.error('[drops] Cannot fetch channel. Check GENERAL_CHANNEL_ID:', config.generalChannelId, '-', e.message);
    return null;
  });
  if (!channel || !channel.isTextBased()) {
    console.error('[drops] Channel not found or not a text channel:', config.generalChannelId);
    return scheduleNext();
  }

  const type = nextType;
  nextType = type === 'pirate' ? 'flag' : 'pirate';

  const amount = type === 'pirate'
    ? randInt(config.pirateMin, config.pirateMax)
    : randInt(config.flagMin, config.flagMax);

  let code = null;
  let country = null;
  let image;
  let title;
  let description;

  if (type === 'pirate') {
    code = pirateCode();
    image = PIRATE_GIF;
    title = '🏴‍☠️ PIRATE BOX DROP!';
    description =
      `A pirate box appeared!\n**Prize inside:** ???\n\n` +
      `**Code:** \`${code}\`\n**First to claim!**\n\n` +
      `⏱️ You have **${config.dropClaimMs / 1000} seconds**.`;
  } else {
    country = pick(COUNTRIES);
    image = flagImage(country);
    title = '🚩 FLAG DROP!';
    description =
      `${country.flag} A flag appeared!\n**Prize inside:** ???\n\n` +
      `First to type \`.<country name>\` wins the money!\n` +
      `Example: for the USA flag, type \`.united states\` (or \`.united state\`)\n\n` +
      `⏱️ You have **${config.dropClaimMs / 1000} seconds**.`;
  }

  const embed = baseEmbed(title, description, 0xf0b232).setImage(image);

  const msg = await channel.send({ embeds: [embed] }).catch(e => {
    console.error('[drops] Failed to send drop:', e.message);
    return null;
  });
  if (!msg) return scheduleNext();
  console.log(`[drops] Sent ${type} drop in ${channel.name}`);
  if (notifier) await notifier(embed, type, channel.name).catch(e =>
    console.error('[drops] Notification failed:', e.message));

  activeDrop = {
    type, code, country, amount, channelId: channel.id,
    messageId: msg.id, claimed: false, expiresAt: Date.now() + config.dropClaimMs
  };

  expireTimer = setTimeout(() => expireDrop(msg), config.dropClaimMs);
}

async function expireDrop(msg) {
  if (!activeDrop || activeDrop.claimed) return;
  activeDrop.claimed = true;
  resetAllStreaks();
  console.log(`[drops] ${activeDrop.type} drop expired unclaimed — deleting message`);
  await msg.delete().catch(e => console.error('[drops] Failed to delete expired drop:', e.message));
  activeDrop = null;
  scheduleNext();
}

async function handleMessage(message) {
  if (!activeDrop || activeDrop.claimed) return false;
  if (message.author.bot) return false;
  if (message.channel.id !== activeDrop.channelId) return false;

  const typed = message.content.trim().toLowerCase();

  if (activeDrop.type === 'flag') {
    // Claim with .<country name> or .flag <country name>.
    const flagPrefix = config.prefix + 'flag ';
    let name;
    if (typed.startsWith(flagPrefix)) name = typed.slice(flagPrefix.length).trim();
    else if (typed.startsWith(config.prefix)) name = typed.slice(config.prefix.length).trim();
    else return false;
    if (!activeDrop.country.names.includes(name)) return false;
  } else {
    // Pirate box: accept ".CODE" or plain "CODE".
    const code = typed.startsWith(config.prefix) ? typed.slice(config.prefix.length).trim() : typed;
    if (code !== activeDrop.code.toLowerCase()) return false;
  }

  activeDrop.claimed = true;
  if (expireTimer) clearTimeout(expireTimer);

  const winner = message.author;
  const amount = activeDrop.amount;
  const type = activeDrop.type;
  const country = activeDrop.country;

  const isFlag = type === 'flag';
  const label = isFlag ? 'Flag' : 'Box';
  const streakKey = isFlag ? 'flagStreak' : 'boxStreak';
  const totalKey = isFlag ? 'flagStreakTotal' : 'boxStreakTotal';

  // Separate flag and box streaks; a win resets the other kind for everyone.
  for (const id of db.allUsers()) {
    if (id === winner.id) continue;
    const u = eco.get(id);
    const s = u.stats;
    if (s.streak || s.streakTotal || s.flagStreak || s.flagStreakTotal || s.boxStreak || s.boxStreakTotal) {
      s.streak = 0; s.streakTotal = 0;
      s.flagStreak = 0; s.flagStreakTotal = 0;
      s.boxStreak = 0; s.boxStreakTotal = 0;
      eco.save(u);
    }
  }
  const wu = eco.get(winner.id);
  wu.stats[streakKey] = (wu.stats[streakKey] || 0) + 1;
  wu.stats[totalKey] = (wu.stats[totalKey] || 0) + amount;
  wu.stats[isFlag ? 'boxStreak' : 'flagStreak'] = 0;
  wu.stats[isFlag ? 'boxStreakTotal' : 'flagStreakTotal'] = 0;
  wu.stats.dropsClaimed = (wu.stats.dropsClaimed || 0) + 1;
  eco.save(wu);
  eco.addCash(winner.id, amount, 'drop', `${type} drop claim`);

  const channel = await client.channels.fetch(activeDrop.channelId).catch(() => null);
  const oldMsg = channel ? await channel.messages.fetch(activeDrop.messageId).catch(() => null) : null;
  const streakLine = `${label} streak: **${wu.stats[streakKey]}** in a row` +
    (wu.stats[streakKey] >= config.streakRequired ? ` — use \`.streak ${isFlag ? 'flag' : 'box'}\` to cash in!` : '');
  if (!isFlag) {
    await message.delete().catch(() => {});
    if (oldMsg) await oldMsg.delete().catch(() => {});
    const embed = baseEmbed('✅ Claimed!',
      `<@${winner.id}> claimed the code and won **${money(amount)}**!\n${streakLine}`,
      0x23a55a
    ).setImage(PIRATE_GIF);
    const popup = await channel.send({ embeds: [embed] }).catch(() => null);
    if (popup) setTimeout(() => popup.delete().catch(() => {}), 5000).unref();
  } else if (oldMsg) {
    const embed = baseEmbed('✅ Claimed!',
      `<@${winner.id}> was first to type \`.${country.names[0]}\` and won **${money(amount)}**!\n${streakLine}`,
      0x23a55a
    ).setImage(flagImage(country));
    await oldMsg.edit({ embeds: [embed] }).catch(() => {});
  }

  activeDrop = null;
  scheduleNext();
  return true;
}

function start(clientInstance) {
  client = clientInstance;
  scheduleNext();
}

module.exports = { start, handleMessage, setNotifier };
