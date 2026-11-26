const config = require('./config');
const db = require('./db');
const eco = require('./economy');
const gear = require('./gear');
const drops = require('./drops');
const minigames = require('./minigames');
const dungeons = require('./dungeons');
const {
  randInt, money, mentionedId, isAdmin, baseEmbed, bar, fmtDuration
} = require('./utils');

const replies = {
  err: (msg, text) => msg.reply({ content: `❌ ${text}` }),
  ok: (msg, text) => msg.reply({ content: text }),
  embed: (msg, embed) => msg.reply({ embeds: [embed] })
};

function cooldownReply(msg, left, name) {
  return replies.err(msg, `${name} is on cooldown. Wait **${fmtDuration(left)}**.`);
}

function adapter(msg) {
  return { reply: o => msg.reply(o), user: msg.author, channel: msg.channel };
}

const commands = {};

commands.help = async (msg) => {
  const e = baseEmbed('📖 Economy Bot Commands',
    `**Core:** \`.balance\` \`.daily\` \`.work\` \`.donate @user amt\` \`.leaderboard\` \`.stats\` \`.history\`\n` +
    `**Earn:** \`.beg\` \`.fish\` \`.mine\` \`.crime\` \`.rob @user\` \`.quest\` \`.streak\` \`.voice\`\n` +
    `**Gamble:** \`.coinflip amt\` \`.gamble amt\` \`.duel @user amt\` \`.lottery buy|draw\`\n` +
    `**Bank:** \`.deposit amt\` \`.withdraw amt\` \`.tax %\` (admin)\n` +
    `**Shop:** \`.shop\` \`.buy name\` \`.sell mat amt\` \`.sellall\` \`.inventory\` \`.buyrole @role\`\n` +
    `**Gear:** \`.equip axe|rod|sword #\` \`.repair #\` \`.combine # #\` \`.upgrade axe|rod|sword #\` \`.enchant kind # #\` \`.open\`\n` +
    `**Passive:** \`.collect\` \`.title text\` \`.nickname text\` \`.gift @user amt\`\n` +
    `**Dungeon:** \`.dungeon\` (solo) \`.dungeon team\`\n` +
    `**Other:** \`.ask question\` \`.notify\` \`.help\``,
    0x5865f2);
  replies.embed(msg, e);
};

commands.balance = async (msg) => {
  const u = eco.get(msg.author.id);
  replies.embed(msg, baseEmbed('💰 Balance',
    `**Cash:** ${money(u.cash)}\n**Bank:** ${money(u.bank)}\n**Net worth:** ${money(eco.netWorth(u))}${u.title ? `\n**Title:** ${u.title}` : ''}`,
    0x23a55a));
};

commands.daily = async (msg) => {
  const u = eco.get(msg.author.id);
  const left = eco.onCooldown(u, 'daily', config.dailyCooldown);
  if (left) return cooldownReply(msg, left, '.daily');
  eco.setCooldown(u, 'daily');
  eco.save(u);
  const amt = randInt(config.dailyMin, config.dailyMax);
  eco.addCash(msg.author.id, amt, 'daily', 'daily claim');
  replies.ok(msg, `✅ You claimed **${money(amt)}** from \`.daily\`! Come back in 24h.`);
};

commands.work = async (msg) => {
  const u = eco.get(msg.author.id);
  const left = eco.onCooldown(u, 'work', config.workCooldown);
  if (left) return cooldownReply(msg, left, '.work');
  eco.setCooldown(u, 'work');
  eco.save(u);
  const amt = randInt(config.workMin, config.workMax);
  eco.addCash(msg.author.id, amt, 'work', 'work claim');
  replies.ok(msg, `🔨 You earned **${money(amt)}** from \`.work\`!`);
};

commands.donate = async (msg, args) => {
  const id = mentionedId(args[0] || '');
  const amt = parseInt(args[1]);
  if (!id || !amt || amt <= 0) return replies.err(msg, 'Usage: `.donate @user amount`');
  if (id === msg.author.id) return replies.err(msg, 'You cannot donate to yourself.');
  if (!eco.transfer(msg.author.id, id, amt)) return replies.err(msg, 'Not enough cash.');
  replies.ok(msg, `💸 You donated **${money(amt)}** to <@${id}>!`);
};

commands.leaderboard = async (msg, args) => {
  const weekly = args[0] === 'weekly';
  const list = eco.leaderboard(10, weekly);
  const text = list.map((p, i) => `**${i + 1}.** <@${p.id}> — ${money(p.worth)}`).join('\n');
  replies.embed(msg, baseEmbed(weekly ? '🏆 Weekly Leaderboard' : '🏆 Richest Players', text || 'No players yet.', 0xf0b232));
};

commands.admin = async (msg, args) => {
  if (!isAdmin(msg, config.adminRoleId)) return replies.err(msg, 'Admin only.');
  const action = args[0], id = mentionedId(args[1] || ''), amt = parseInt(args[2]);
  if (!['add', 'remove', 'set'].includes(action) || !id || isNaN(amt)) {
    return replies.err(msg, 'Usage: `.admin add|remove|set @user amount`');
  }
  if ((action === 'add' || action === 'remove') && amt <= 0) {
    return replies.err(msg, 'Amount must be positive.');
  }
  if (action === 'add') eco.addCash(id, amt, 'admin', 'admin add');
  if (action === 'remove' && !eco.takeCash(id, amt, 'admin', 'admin remove')) {
    return replies.err(msg, 'Not enough cash.');
  }
  if (action === 'set') {
    const u = eco.get(id);
    u.cash = Math.max(0, amt);
    eco.save(u);
    db.addTransaction(id, 'admin', u.cash, 'admin set');
  }
  replies.ok(msg, `✅ <@${id}> cash is now **${money(eco.get(id).cash)}**.`);
};

commands.beg = async (msg) => {
  const u = eco.get(msg.author.id);
  const left = eco.onCooldown(u, 'beg', config.begCooldown);
  if (left) return cooldownReply(msg, left, '.beg');
  eco.setCooldown(u, 'beg'); eco.save(u);
  const amt = randInt(config.begMin, config.begMax);
  eco.addCash(msg.author.id, amt, 'beg', 'begging');
  replies.ok(msg, `🥺 Someone took pity on you and gave **${money(amt)}**.`);
};

commands.fish = async (msg) => {
  const u = eco.get(msg.author.id);
  if (!gear.getEquipped(u, 'rod')) return replies.err(msg, 'You need an equipped rod! Use `.shop` to buy one.');
  const left = eco.onCooldown(u, 'fish', config.fishCooldown);
  if (left) return cooldownReply(msg, left, '.fish');
  eco.setCooldown(u, 'fish'); eco.save(u);
  await minigames.runTiming(adapter(msg), {
    title: '🎣 Fishing!',
    description: 'Catch the sweet spot for a big fish!',
    color: 0x5865f2,
    onResult: async (perfect) => {
      const uu = eco.get(msg.author.id);
      const res = gear.fishingYield(uu, perfect);
      if (res.error) return msg.reply(`❌ ${res.error}`);
      eco.save(uu);
      const text = Object.entries(res.loot).map(([k, v]) => `${k}: ${v}`).join(', ');
      msg.reply(`🎣 You caught: **${text}**${perfect ? ' (PERFECT!)' : ''}`);
    }
  });
};

commands.mine = async (msg) => {
  const u = eco.get(msg.author.id);
  await minigames.runTiming(adapter(msg), {
    title: '⛏️ Mining!',
    description: 'Hit the sweet spot for better ore!',
    color: 0xf0b232,
    onResult: async (perfect) => {
      const uu = eco.get(msg.author.id);
      const res = gear.miningYield(uu, perfect);
      if (res.error) return msg.reply(`❌ ${res.error}`);
      eco.save(uu);
      uu.quests.mines = (uu.quests.mines || 0) + 1;
      eco.save(uu);
      const text = Object.entries(res.loot).map(([k, v]) => `${k}: ${v}`).join(', ');
      msg.reply(`⛏️ You mined: **${text || 'nothing'}**${res.broken ? ' — your axe broke!' : ''}${perfect ? ' (PERFECT!)' : ''}`);
    }
  });
};

commands.crime = async (msg) => {
  const u = eco.get(msg.author.id);
  const left = eco.onCooldown(u, 'crime', config.crimeCooldown);
  if (left) return cooldownReply(msg, left, '.crime');
  eco.setCooldown(u, 'crime');
  u.stats.crimes++;
  let text;
  if (Math.random() < 0.55) {
    const amt = randInt(config.crimeMin, config.crimeMax);
    u.cash += amt; u.stats.earned += amt;
    text = `🦹 Your crime succeeded! You got **${money(amt)}**.`;
    eco.addTransaction(msg.author.id, 'crime', amt, 'success');
  } else {
    const fine = randInt(config.crimeFailMin, config.crimeFailMax);
    if (eco.hasInsurance(u)) {
      text = `🚔 You got caught, but insurance covered the **${money(fine)}** fine!`;
    } else {
      u.cash = Math.max(0, u.cash - fine);
      u.jailUntil = Date.now() + config.jailMs;
      text = `🚔 You got caught! Fined **${money(fine)}** and jailed for 5 minutes.`;
    }
  }
  eco.save(u);
  replies.ok(msg, text);
};

commands.rob = async (msg, args) => {
  const id = mentionedId(args[0] || '');
  if (!id) return replies.err(msg, 'Usage: `.rob @user`');
  if (id === msg.author.id) return replies.err(msg, 'You cannot rob yourself.');
  const u = eco.get(msg.author.id);
  const left = eco.onCooldown(u, 'rob', config.robCooldown);
  if (left) return cooldownReply(msg, left, '.rob');
  if (eco.inJail(u)) return replies.err(msg, 'You are in jail! Wait for your release.');
  eco.setCooldown(u, 'rob'); eco.save(u);

  const target = eco.get(id);
  if (target.cash <= 0) return replies.err(msg, 'That user has no unbanked cash to rob (banked money is safe).');

  if (Math.random() < config.robFailChance) {
    if (!eco.hasInsurance(u)) {
      const fine = Math.floor(u.cash * 0.1);
      u.cash -= fine;
      u.jailUntil = Date.now() + config.jailMs;
      eco.save(u);
      return replies.ok(msg, `🚔 Robbery failed! Fined **${money(fine)}** and jailed for 5 min.`);
    }
    return replies.ok(msg, '🚔 Robbery failed, but insurance saved you from the fine!');
  }

  const pct = randInt(config.robMinPct, config.robMaxPct);
  const amt = Math.floor(target.cash * pct / 100);
  if (amt <= 0) return replies.err(msg, 'Nothing to steal.');
  target.cash -= amt; eco.save(target);
  u.cash += amt; u.stats.robWins++; eco.save(u);
  eco.addTransaction(id, 'robbed', -amt, `robbed by ${msg.author.id}`);
  eco.addTransaction(msg.author.id, 'rob', amt, `robbed ${id}`);
  replies.ok(msg, `🦹 Robbery successful! You stole **${money(amt)}** (${pct}%) from <@${id}>'s unbanked cash!`);
};

commands.quest = async (msg) => {
  const u = eco.get(msg.author.id);
  const today = new Date().toDateString();
  if (u.quests.day !== today) { u.quests = { day: today, mines: 0, claim: false }; eco.save(u); }
  const progress = Math.min(5, u.quests.mines || 0);
  if (progress >= 5 && !u.quests.claim) {
    u.quests.claim = true;
    u.cash += 800; u.stats.earned += 800;
    eco.save(u);
    return replies.ok(msg, '✅ Quest complete! Reward: **$800**');
  }
  replies.ok(msg, `📋 Daily quest: Mine 5 times today. Progress: **${progress}/5**`);
};

commands.streak = async (msg) => {
  const u = eco.get(msg.author.id);
  const s = u.stats.streak || 0;
  if (s < config.streakRequired) {
    return replies.ok(msg, `🔥 Drop streak: **${s}/${config.streakRequired}**. Be first to claim drops to build it!`);
  }
  const bonus = Math.floor(u.stats.streakTotal * config.streakBonusPct / 100);
  u.cash += bonus; u.stats.earned += bonus;
  u.stats.streak = 0; u.stats.streakTotal = 0;
  eco.save(u);
  eco.addTransaction(msg.author.id, 'streak', bonus, 'streak bonus');
  replies.ok(msg, `🔥 Streak bonus paid: **${money(bonus)}** (1.3% of your 5-drop winnings). Streak reset!`);
};

commands.coinflip = async (msg, args) => {
  const amt = parseInt(args[0]);
  if (!amt || amt < 100) return replies.err(msg, 'Usage: `.coinflip amount` (min $100)');
  if (!eco.takeCash(msg.author.id, amt, 'bet', 'coinflip')) return replies.err(msg, 'Not enough cash.');
  if (Math.random() < 0.5) {
    eco.addCash(msg.author.id, amt * 2, 'win', 'coinflip win');
    replies.ok(msg, `🪙 Heads! You won **${money(amt * 2)}**!`);
  } else replies.ok(msg, `🪙 Tails! You lost **${money(amt)}**.`);
};

commands.gamble = async (msg, args) => {
  const amt = parseInt(args[0]);
  if (!amt || amt < config.gambleMinBet || amt > config.gambleMaxBet) {
    return replies.err(msg, `Usage: \`.gamble amount\` (${money(config.gambleMinBet)}–${money(config.gambleMaxBet)})`);
  }
  if (!eco.takeCash(msg.author.id, amt, 'bet', 'gamble')) return replies.err(msg, 'Not enough cash.');
  const r = Math.random();
  let mult = 0;
  if (r < 0.45) mult = 0;
  else if (r < 0.75) mult = 1.2;
  else if (r < 0.92) mult = 1.6;
  else mult = 2.5;
  if (mult === 0) return replies.ok(msg, `🎲 You lost **${money(amt)}**.`);
  const win = Math.floor(amt * mult);
  eco.addCash(msg.author.id, win, 'win', 'gamble win');
  replies.ok(msg, `🎲 You won **${money(win)}** (×${mult})!`);
};

commands.duel = async (msg, args) => {
  const id = mentionedId(args[0] || '');
  const amt = parseInt(args[1]);
  if (!id || !amt) {
    const pending = db.db.prepare('SELECT * FROM duels WHERE target=? AND status=?').all(msg.author.id, 'pending');
    if (!pending.length) return replies.err(msg, 'Usage: `.duel @user amount` or `.duel` to see challenges.');
    const d = pending[0];
    if (!eco.takeCash(msg.author.id, d.amount, 'bet', 'duel')) {
      eco.addCash(d.challenger, d.amount, 'refund', 'duel cancelled');
      db.db.prepare('UPDATE duels SET status=? WHERE id=?').run('done', d.id);
      return replies.err(msg, 'Not enough cash to accept. Challenger was refunded.');
    }
    // The challenger already paid when creating the duel, so only charge the acceptor.
    const winner = Math.random() < 0.5 ? msg.author.id : d.challenger;
    eco.addCash(winner, d.amount * 2, 'win', 'duel win');
    db.db.prepare('UPDATE duels SET status=? WHERE id=?').run('done', d.id);
    return replies.ok(msg, `⚔️ Duel winner: <@${winner}> takes **${money(d.amount * 2)}**!`);
  }
  if (id === msg.author.id) return replies.err(msg, 'Cannot duel yourself.');
  if (amt < config.duelMinBet || amt > config.duelMaxBet) return replies.err(msg, `Bet must be ${money(config.duelMinBet)}–${money(config.duelMaxBet)}.`);
  if (!eco.takeCash(msg.author.id, amt, 'bet', 'duel challenge')) return replies.err(msg, 'Not enough cash.');
  const did = Math.random().toString(36).slice(2, 10);
  db.db.prepare('INSERT INTO duels (id,challenger,target,amount,status) VALUES (?,?,?,?,?)')
    .run(did, msg.author.id, id, amt, 'pending');
  replies.ok(msg, `⚔️ <@${id}> you were challenged for **${money(amt)}**! Type \`.duel\` to accept. (ID: ${did})`);
};

commands.lottery = async (msg, args) => {
  const action = args[0] || 'buy';
  const row = db.db.prepare('SELECT * FROM lottery WHERE id=1').get() || { pool: 0, entries: '[]' };
  let entries;
  try { entries = JSON.parse(row.entries); } catch { entries = []; }
  if (action === 'buy') {
    if (!eco.takeCash(msg.author.id, config.lotteryTicketPrice, 'lottery', 'ticket')) return replies.err(msg, 'Not enough cash.');
    entries.push(msg.author.id);
    db.db.prepare('INSERT INTO lottery (id,pool,entries) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET pool=excluded.pool,entries=excluded.entries')
      .run(row.pool + config.lotteryTicketPrice, JSON.stringify(entries));
    return replies.ok(msg, `🎟️ You bought a lottery ticket! Pool: **${money(row.pool + config.lotteryTicketPrice)}**`);
  }
  if (action === 'draw') {
    if (!isAdmin(msg, config.adminRoleId)) return replies.err(msg, 'Admin only.');
    if (!entries.length) return replies.err(msg, 'No entries yet.');
    const winner = entries[randInt(0, entries.length - 1)];
    eco.addCash(winner, row.pool, 'lottery', 'jackpot');
    db.db.prepare('UPDATE lottery SET pool=0, entries=? WHERE id=1').run('[]');
    return replies.ok(msg, `🎉 Jackpot **${money(row.pool)}** goes to <@${winner}>!`);
  }
  replies.ok(msg, `🎟️ Lottery pool: **${money(row.pool)}** — ${entries.length} tickets. \`.lottery buy\` / \`.lottery draw\` (admin)`);
};

commands.deposit = async (msg, args) => {
  const amt = parseInt(args[0]);
  if (!amt || amt <= 0) return replies.err(msg, 'Usage: `.deposit amount`');
  if (!eco.deposit(msg.author.id, amt)) return replies.err(msg, 'Not enough cash.');
  replies.ok(msg, `🏦 Deposited **${money(amt)}** into your bank.`);
};

commands.withdraw = async (msg, args) => {
  const amt = parseInt(args[0]);
  if (!amt || amt <= 0) return replies.err(msg, 'Usage: `.withdraw amount`');
  if (!eco.withdraw(msg.author.id, amt)) return replies.err(msg, 'Not enough banked money.');
  replies.ok(msg, `🏦 Withdrew **${money(amt)}** from your bank.`);
};

commands.tax = async (msg, args) => {
  if (!isAdmin(msg, config.adminRoleId)) return replies.err(msg, 'Admin only.');
  const pct = parseInt(args[0]);
  if (!pct || pct <= 0 || pct > 50) return replies.err(msg, 'Usage: `.tax percent` (1–50)');
  const total = eco.taxAll(pct);
  replies.ok(msg, `💼 Collected **${money(total)}** in tax (${pct}%).`);
};

commands.shop = async (msg) => {
  const items = db.getShop();
  const text = items.map(i => `• **${i.name}** — ${money(i.price)} (${i.type})`).join('\n');
  replies.embed(msg, baseEmbed('🛒 Bot Store', text, 0x5865f2));
};

commands.buy = async (msg, args) => {
  const name = args.join(' ').toLowerCase();
  const item = db.getShop().find(i => i.name.toLowerCase() === name || i.name.toLowerCase().startsWith(name));
  if (!item) return replies.err(msg, 'Item not found. Use `.shop`.');
  if (eco.get(msg.author.id).cash < item.price) return replies.err(msg, `Need ${money(item.price)}.`);
  eco.takeCash(msg.author.id, item.price, 'shop', item.name);
  const u = eco.get(msg.author.id);
  const d = item.data || {};
  if (item.type === 'lootbox') u.inventory.items.push('lootbox');
  if (item.type === 'potion') u.inventory.items.push('potion');
  if (item.type === 'key') u.inventory.items.push('key');
  if (item.type === 'axe_rent') u.inventory.axes.push(gear.newAxe(d.tier, true));
  if (item.type === 'axe_buy') u.inventory.axes.push(gear.newAxe(d.tier, false));
  if (item.type === 'rod_buy') u.inventory.rods.push(gear.newRod(d.tier));
  if (item.type === 'book') u.inventory.books.push(gear.newBook(d.type));
  if (item.type === 'insurance') u.insuranceUntil = Date.now() + 60 * 60 * 1000;
  if (item.type === 'bail') u.jailUntil = 0;
  if (item.type === 'business') u.business = { name: item.name, rate: d.rate, last: Date.now() };
  if (item.type === 'pet') u.pet = { name: item.name, rate: d.rate, last: Date.now() };
  if (item.type === 'house') u.house = { name: item.name, rate: d.rate, last: Date.now() };
  if (item.type === 'farm') u.farm = { name: item.name, rate: d.rate, last: Date.now() };
  eco.save(u);
  replies.ok(msg, `🛒 You bought **${item.name}** for **${money(item.price)}**!`);
};

commands.sell = async (msg, args) => {
  const mat = (args[0] || '').toLowerCase();
  const amt = parseInt(args[1]) || 1;
  const u = eco.get(msg.author.id);
  const value = config.materialValue[mat];
  if (!value) return replies.err(msg, 'Unknown material. Use `.inventory`.');
  if ((u.inventory.materials[mat] || 0) < amt) return replies.err(msg, 'You do not have that much.');
  u.inventory.materials[mat] -= amt;
  const total = value * amt;
  u.cash += total; u.stats.earned += total;
  eco.save(u); eco.addTransaction(msg.author.id, 'sell', total, `${amt} ${mat}`);
  replies.ok(msg, `💰 Sold ${amt} ${mat} for **${money(total)}**.`);
};

commands.sellall = async (msg) => {
  const u = eco.get(msg.author.id);
  const total = gear.sellAll(u);
  if (!total) return replies.err(msg, 'Nothing to sell.');
  eco.save(u);
  replies.ok(msg, `💰 Sold all materials for **${money(total)}**!`);
};

commands.inventory = async (msg) => {
  const u = eco.get(msg.author.id);
  const m = Object.entries(u.inventory.materials).filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: ${v}`).join(', ') || 'none';
  const axes = u.inventory.axes.map((a, i) => `[${i}] ${a.tier} axe ${a.rented ? `(rented ${a.uses})` : `+${a.power} (${a.durability}/${a.maxDurability})`}`).join('\n') || 'none';
  const rods = u.inventory.rods.map((r, i) => `[${i}] ${r.tier} rod +${r.power}`).join('\n') || 'none';
  const swords = u.inventory.swords.map((s, i) => `[${i}] ${s.name} (${s.role}) +${s.power}`).join('\n') || 'none';
  const books = u.inventory.books.map((b, i) => `[${i}] ${b.type} book +${b.level}`).join(', ') || 'none';
  const items = [...new Set(u.inventory.items)].map(i => `${i}: ${u.inventory.items.filter(x => x === i).length}`).join(', ') || 'none';
  replies.embed(msg, baseEmbed('🎒 Inventory',
    `**Materials:** ${m}\n\n**Axes:**\n${axes}\n\n**Rods:**\n${rods}\n\n**Swords:**\n${swords}\n\n**Books:** ${books}\n\n**Items:** ${items}` +
    `\n\nEquipped: axe=${u.gear.axe || 'none'} rod=${u.gear.rod || 'none'} sword=${u.gear.sword || 'none'}`,
    0x5865f2));
};

commands.buyrole = async (msg, args) => {
  const role = msg.mentions.roles.first();
  if (!role) return replies.err(msg, 'Usage: `.buyrole @role` ($5,000)');
  const price = 5000;
  if (!eco.takeCash(msg.author.id, price, 'buyrole', role.name)) return replies.err(msg, 'Need $5,000.');
  try {
    await msg.member.roles.add(role);
    replies.ok(msg, `🎭 You bought **${role.name}** for **${money(price)}**!`);
  } catch {
    eco.addCash(msg.author.id, price, 'refund', 'role purchase failed');
    replies.err(msg, 'I cannot give that role. Make sure my role is above it.');
  }
};

commands.open = async (msg) => {
  const u = eco.get(msg.author.id);
  const idx = u.inventory.items.indexOf('lootbox');
  if (idx < 0) return replies.err(msg, 'You have no loot boxes. Buy one from `.shop`.');
  u.inventory.items.splice(idx, 1);
  const rewards = gear.lootBoxReward(u);
  eco.save(u);
  replies.ok(msg, `📦 Loot box opened! You got: **${rewards.join(', ')}**`);
};

commands.equip = async (msg, args) => {
  const kind = (args[0] || '').toLowerCase();
  const idx = parseInt(args[1]);
  if (!['axe', 'rod', 'sword'].includes(kind) || isNaN(idx)) return replies.err(msg, 'Usage: `.equip axe|rod|sword index`');
  const u = eco.get(msg.author.id);
  const item = u.inventory[kind + 's'][idx];
  if (!item) return replies.err(msg, 'Item not found. Check `.inventory`.');
  u.gear[kind] = item.id;
  eco.save(u);
  replies.ok(msg, `✅ Equipped **${item.name || item.tier + ' ' + kind}**.`);
};

commands.repair = async (msg, args) => {
  const idx = parseInt(args[0]);
  const u = eco.get(msg.author.id);
  const res = gear.repairAxe(u, idx);
  if (res.error) return replies.err(msg, res.error);
  eco.save(u);
  replies.ok(msg, `🔧 Repaired your ${u.inventory.axes[idx].tier} axe with ${res.cost} ${res.mat}!`);
};

commands.combine = async (msg, args) => {
  const i = parseInt(args[0]), j = parseInt(args[1]);
  const u = eco.get(msg.author.id);
  const res = gear.combineAxes(u, i, j);
  if (res.error) return replies.err(msg, res.error);
  eco.save(u);
  replies.ok(msg, `🔧 Combined two axes into a full-durability **${res.axe.tier} axe +${res.axe.power}**!`);
};

commands.upgrade = async (msg, args) => {
  const kind = (args[0] || '').toLowerCase();
  const idx = parseInt(args[1]);
  if (!['axe', 'rod', 'sword'].includes(kind) || isNaN(idx)) return replies.err(msg, 'Usage: `.upgrade axe|rod|sword index`');
  const u = eco.get(msg.author.id);
  const res = gear.upgradePower(u, kind, idx);
  if (res.error) return replies.err(msg, res.error);
  eco.save(u);
  replies.ok(msg, `⬆️ Upgraded to **+${res.power} power** for **${money(res.cost)}**!`);
};

commands.enchant = async (msg, args) => {
  const kind = (args[0] || '').toLowerCase();
  const itemIdx = parseInt(args[1]), bookIdx = parseInt(args[2]);
  if (!['axe', 'rod', 'sword'].includes(kind) || isNaN(itemIdx) || isNaN(bookIdx)) {
    return replies.err(msg, 'Usage: `.enchant axe|rod|sword itemIndex bookIndex`');
  }
  const u = eco.get(msg.author.id);
  const res = gear.enchantItem(u, kind, itemIdx, bookIdx);
  if (res.error) return replies.err(msg, res.error);
  eco.save(u);
  replies.ok(msg, `✨ Enchanted with **${res.type} +${res.level}**!`);
};

commands.voice = async (msg) => {
  const u = eco.get(msg.author.id);
  replies.ok(msg, `🔊 Voice time: **${Math.floor((u.voice.seconds || 0) / 60)} min**. Stay 30 min for **$300**, 1 hour for another **$1,000**!`);
};

commands.collect = async (msg) => {
  const u = eco.get(msg.author.id);
  const now = Date.now();
  let total = 0;
  for (const key of ['business', 'pet', 'house', 'farm']) {
    if (u[key]) {
      const hours = Math.floor((now - (u[key].last || now)) / (60 * 60 * 1000));
      if (hours > 0) {
        total += u[key].rate * hours;
        u[key].last = now;
      }
    }
  }
  if (!total) return replies.err(msg, 'No passive income ready yet (need an hour).');
  u.cash += total; u.stats.earned += total;
  eco.save(u);
  replies.ok(msg, `💰 Collected **${money(total)}** passive income!`);
};

commands.title = async (msg, args) => {
  const text = args.join(' ').slice(0, 32);
  if (!text) return replies.err(msg, 'Usage: `.title text` ($1,000)');
  if (!eco.takeCash(msg.author.id, 1000, 'title', text)) return replies.err(msg, 'Need $1,000.');
  const u = eco.get(msg.author.id); u.title = text; eco.save(u);
  replies.ok(msg, `🎭 Your title is now **${text}**!`);
};

commands.nickname = async (msg, args) => {
  const text = args.join(' ').slice(0, 30);
  if (!text) return replies.err(msg, 'Usage: `.nickname text` ($1,500)');
  if (!eco.takeCash(msg.author.id, 1500, 'nickname', text)) return replies.err(msg, 'Need $1,500.');
  try { await msg.member.setNickname(text); replies.ok(msg, `✅ Nickname changed to **${text}**.`); }
  catch { eco.addCash(msg.author.id, 1500, 'refund', 'nickname failed'); replies.err(msg, 'I cannot change your nickname.'); }
};

commands.gift = async (msg, args) => {
  const id = mentionedId(args[0] || ''), amt = parseInt(args[1]);
  if (!id || !amt || amt <= 0) return replies.err(msg, 'Usage: `.gift @user amount`');
  if (!eco.transfer(msg.author.id, id, amt)) return replies.err(msg, 'Not enough cash.');
  replies.embed(msg, baseEmbed('🎁 Gift!', `<@${msg.author.id}> gifted **${money(amt)}** to <@${id}>!`, 0x23a55a));
};

commands.stats = async (msg) => {
  const u = eco.get(msg.author.id);
  replies.embed(msg, baseEmbed('📊 Your Stats',
    `**Earned:** ${money(u.stats.earned)}\n**Spent:** ${money(u.stats.spent)}\n` +
    `**Won:** ${money(u.stats.won)}\n**Drops claimed:** ${u.stats.dropsClaimed}\n` +
    `**Rob wins:** ${u.stats.robWins}\n**Dungeon wins:** ${u.stats.dungeonWins}\n` +
    `**Drop streak:** ${u.stats.streak}`,
    0x5865f2));
};

commands.history = async (msg) => {
  const rows = db.getTransactions(msg.author.id, 10);
  const text = rows.map(r => `${new Date(r.time).toLocaleString()} — ${r.type}: ${r.amount > 0 ? '+' : ''}${money(r.amount)} (${r.note})`).join('\n') || 'No transactions yet.';
  replies.embed(msg, baseEmbed('📜 Transaction History', text, 0x5865f2));
};

commands.wallet = async (msg) => {
  const u = eco.get(msg.author.id);
  replies.embed(msg, baseEmbed('👛 Wallet',
    `**${msg.author.username}**${u.title ? ` — *${u.title}*` : ''}\n\n` +
    `Cash: **${money(u.cash)}**\nBank: **${money(u.bank)}**\nNet worth: **${money(eco.netWorth(u))}**`,
    0xf0b232));
};

commands.notify = async (msg) => {
  const u = eco.get(msg.author.id);
  u.notify = u.notify ? 0 : 1;
  eco.save(u);
  replies.ok(msg, `🔔 Drop notifications ${u.notify ? 'enabled' : 'disabled'}. You will be DMed when a drop appears.`);
};

commands.ask = async (msg, args) => {
  if (!config.openaiKey) return replies.err(msg, 'ChatGPT is not configured (no OPENAI_API_KEY).');
  const question = args.join(' ');
  if (!question) return replies.err(msg, 'Usage: `.ask question`');
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: question }] })
    });
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || 'No answer.';
    replies.ok(msg, `🤖 ${answer.slice(0, 1900)}`);
  } catch (e) { replies.err(msg, 'ChatGPT request failed: ' + e.message); }
};

commands.dungeon = async (msg, args) => {
  const team = (args[0] || '').toLowerCase() === 'team';
  await dungeons.start(adapter(msg), team);
};

module.exports = { commands, replies };
