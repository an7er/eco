const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder
} = require('discord.js');
const config = require('./config');
const eco = require('./economy');
const gear = require('./gear');
const { randInt, money, bar, pick } = require('./utils');

const ENEMIES = [
  { name: 'Forest Beast', hp: 100, dmg: 12, reward: 600, floor: 1 },
  { name: 'Cave Troll', hp: 180, dmg: 18, reward: 1100, floor: 2 },
  { name: 'Shadow Warden', hp: 300, dmg: 26, reward: 2000, floor: 3 },
  { name: 'Dragon Lord', hp: 600, dmg: 40, reward: 5000, floor: 4 }
];

const sessions = new Map();

function newParticipant(userId, u, username) {
  const sword = gear.getEquipped(u, 'sword') || gear.newSword('mage');
  return {
    id: userId, username, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
    sword, stats: u.stats, strength: gear.enchantPower(sword)
  };
}

function render(session, phase = 'fight') {
  const p = session.participants[session.turn % session.participants.length];
  const enemy = session.enemy;
  const desc =
    `**Floor ${enemy.floor} — ${enemy.name}**\n` +
    `Enemy HP: ${bar(enemy.hp, enemy.maxHp)} ${Math.max(0, enemy.hp)}/${enemy.maxHp}\n\n` +
    session.participants.map(m =>
      `${m.id === p.id ? '▶ ' : ''}**${m.username}** (${m.sword.role})\n` +
      `HP ${bar(m.hp, m.maxHp, 8)} ${m.hp}/${m.maxHp} · MP ${bar(m.mp, m.maxMp, 8)} ${m.mp}/${m.maxMp}`
    ).join('\n\n') +
    `\n\n📜 ${session.log}`;

  const embed = new EmbedBuilder()
    .setTitle(phase === 'join' ? '⚔️ DUNGEON — Gathering Party' : '⚔️ DUNGEON — Boss Fight')
    .setDescription(desc)
    .setColor(0xf0b232)
    .setTimestamp();

  const row = new ActionRowBuilder();
  if (phase === 'join') {
    row.addComponents(
      new ButtonBuilder().setCustomId('dg_join').setLabel('Join Party').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('dg_start').setLabel('Start Fight').setStyle(ButtonStyle.Success)
    );
  } else {
    row.addComponents(
      new ButtonBuilder().setCustomId('dg_attack').setLabel('⚔️ Attack').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('dg_magic').setLabel('✨ Magic').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('dg_heal').setLabel('💚 Heal').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('dg_item').setLabel('🎒 Potion').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('dg_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Secondary)
    );
  }
  return { embeds: [embed], components: [row] };
}

async function start(interaction, team) {
  const u = eco.get(interaction.user.id);
  const enemy = pick(ENEMIES);
  const session = {
    participants: [newParticipant(interaction.user.id, u, interaction.user.username)],
    enemy: { ...enemy, maxHp: enemy.hp },
    turn: 0,
    log: team ? 'Party is forming. Others can join!' : `${interaction.user.username} entered the dungeon!`,
    phase: team ? 'join' : 'fight',
    entryFee: 200,
    rewards: { money: enemy.reward, materials: {}, lootbox: 1 },
    maxPlayers: 4
  };
  if (u.cash < session.entryFee) {
    return interaction.reply({ content: `You need ${money(session.entryFee)} entry fee.`, ephemeral: true });
  }
  eco.takeCash(interaction.user.id, session.entryFee, 'dungeon_entry', 'entry fee');

  const reply = await interaction.reply({ ...render(session, session.phase), fetchReply: true });
  session.messageId = reply.id;
  session.channelId = reply.channelId;
  sessions.set(reply.id, session);
  setTimeout(() => {
    if (!session.ended) {
      session.ended = true;
      sessions.delete(reply.id);
    }
  }, 30 * 60 * 1000).unref();

  if (team) {
    const collector = reply.createMessageComponentCollector({ time: 20000 });
    collector.on('collect', async i => {
      if (i.customId === 'dg_join') {
        if (session.participants.some(p => p.id === i.user.id)) {
          return i.reply({ content: 'You already joined!', ephemeral: true });
        }
        if (session.participants.length >= session.maxPlayers) {
          return i.reply({ content: 'Party is full!', ephemeral: true });
        }
        const iu = eco.get(i.user.id);
        if (iu.cash < session.entryFee) return i.reply({ content: 'Not enough entry fee.', ephemeral: true });
        eco.takeCash(i.user.id, session.entryFee, 'dungeon_entry', 'entry fee');
        session.participants.push(newParticipant(i.user.id, iu, i.user.username));
        session.log = `${i.user.username} joined the party!`;
        await i.update(render(session, 'join'));
      } else if (i.customId === 'dg_start') {
        if (i.user.id !== interaction.user.id) return i.reply({ content: 'Only the leader can start.', ephemeral: true });
        collector.stop('start');
        session.phase = 'fight';
        session.log = 'The boss appears! Fight!';
        await i.update(render(session, 'fight'));
      }
    });
    collector.on('end', async (_, reason) => {
      if (reason === 'start' || session.ended) return;
      if (session.participants.length < 1) return;
      session.phase = 'fight';
      session.log = 'The boss appears! Fight!';
      const msg = await interaction.channel.messages.fetch(session.messageId).catch(() => null);
      if (msg) await msg.edit(render(session, 'fight')).catch(() => {});
    });
  }
}

async function handle(interaction) {
  const session = sessions.get(interaction.message.id);
  if (!session || session.ended) return;
  if (interaction.customId === 'dg_join' || interaction.customId === 'dg_start') return;

  const p = session.participants[session.turn % session.participants.length];
  if (interaction.user.id !== p.id) {
    return interaction.reply({ content: `It's ${p.username}'s turn.`, ephemeral: true });
  }

  const enemy = session.enemy;
  let dmg = 0, heal = 0;

  if (interaction.customId === 'dg_attack') {
    dmg = randInt(12, 22) + p.strength * 2;
    if (p.sword.role === 'assassin' && Math.random() < 0.4) {
      dmg *= 2;
      session.log = `${p.username} lands a critical strike!`;
    } else session.log = `${p.username} attacks for ${dmg} damage.`;
  } else if (interaction.customId === 'dg_magic') {
    if (p.mp < 15) return interaction.reply({ content: 'Not enough MP!', ephemeral: true });
    p.mp -= 15;
    dmg = randInt(20, 32) + p.strength * 2;
    session.log = `${p.username} casts ${p.sword.name} for ${dmg} magic damage!`;
    if (p.sword.role === 'burn') { enemy.burn = 3; session.log += ' Burn applied!'; }
    if (p.sword.role === 'poison') { enemy.poison = 3; session.log += ' Poison applied!'; }
  } else if (interaction.customId === 'dg_heal') {
    if (p.mp < 20) return interaction.reply({ content: 'Not enough MP!', ephemeral: true });
    p.mp -= 20;
    heal = p.sword.role === 'healer' ? 35 : 20;
    session.participants.forEach(m => { m.hp = Math.min(m.maxHp, m.hp + heal); });
    session.log = `${p.username} heals the party for ${heal} HP!`;
  } else if (interaction.customId === 'dg_item') {
    const u = eco.get(p.id);
    const idx = u.inventory.items.indexOf('potion');
    if (idx < 0) return interaction.reply({ content: 'You have no Potion!', ephemeral: true });
    u.inventory.items.splice(idx, 1);
    eco.save(u);
    p.hp = Math.min(p.maxHp, p.hp + 25);
    session.log = `${p.username} uses a Potion (+25 HP).`;
  } else if (interaction.customId === 'dg_flee') {
    session.ended = true;
    await interaction.update({ embeds: [new EmbedBuilder()
      .setTitle('🏃 Fled the Dungeon')
      .setDescription('You escaped, but lost the entry fee.')
      .setColor(0x747f8d)], components: [] });
    sessions.delete(interaction.message.id);
    return;
  }

  enemy.hp -= dmg;
  if (enemy.burn > 0) { enemy.hp -= 10; enemy.burn--; }
  if (enemy.poison > 0) { enemy.hp -= 8; enemy.poison--; }

  if (enemy.hp <= 0) {
    session.ended = true;
    const share = Math.floor(session.rewards.money / session.participants.length);
    for (const m of session.participants) {
      eco.addCash(m.id, share, 'dungeon', `${enemy.name} defeated`);
      const u = eco.get(m.id);
      u.stats.dungeonWins++;
      u.inventory.items.push('lootbox');
      eco.save(u);
    }
    await interaction.update({ embeds: [new EmbedBuilder()
      .setTitle('🏆 Victory!')
      .setDescription(`You defeated **${enemy.name}**!\nEach player earned **${money(share)}** and a loot box!`)
      .setColor(0x23a55a)], components: [] });
    sessions.delete(interaction.message.id);
    return;
  }

  // Enemy turn
  const target = pick(session.participants);
  const enemyDmg = randInt(enemy.dmg - 4, enemy.dmg + 4);
  target.hp -= enemyDmg;
  session.log += `\n${enemy.name} hits ${target.username} for ${enemyDmg} damage.`;
  session.turn++;

  if (session.participants.every(m => m.hp <= 0)) {
    session.ended = true;
    for (const m of session.participants) {
      const u = eco.get(m.id);
      if (u.gear.sword) {
        const idx = u.inventory.swords.findIndex(s => s.id === u.gear.sword);
        if (idx >= 0) {
          u.inventory.swords[idx].durability -= 10;
          if (u.inventory.swords[idx].durability <= 0) {
            u.inventory.swords.splice(idx, 1);
            u.gear.sword = null;
          }
        }
      }
      eco.save(u);
    }
    await interaction.update({ embeds: [new EmbedBuilder()
      .setTitle('💀 Defeat')
      .setDescription(`You were defeated by **${enemy.name}**.\nLost **10 sword durability** and the entry fee.`)
      .setColor(0xf23f43)], components: [] });
    sessions.delete(interaction.message.id);
    return;
  }

  await interaction.update(render(session, 'fight'));
}

module.exports = { start, handle, ENEMIES };
