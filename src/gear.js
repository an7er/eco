const config = require('./config');
const db = require('./db');
const { randInt, pick } = require('./utils');

const AXE_TIERS = ['copper', 'iron', 'diamond', 'netherite'];
const ROD_TIERS = ['wood', 'iron', 'diamond', 'netherite'];
const SWORD_ROLES = [
  { role: 'mage', name: 'Ember Spellblade', desc: 'Magic burst damage' },
  { role: 'burn', name: 'Cinderbrand', desc: 'Burn damage over time' },
  { role: 'poison', name: 'Venomfang', desc: 'Poison damage over time' },
  { role: 'healer', name: 'Dawnstaff', desc: 'Heals the team from a distance' },
  { role: 'assassin', name: 'Nightedge', desc: 'High critical burst' }
];
const BOOKS = ['luck', 'durability', 'power', 'critical'];
const MATERIALS = ['stone', 'dirt', 'sand', 'gravel', 'copper', 'iron', 'diamond', 'netherite', 'special'];
const FISH = ['fish', 'rarefish'];

function newAxe(tier, rented = false) {
  const max = config.axeDurability[tier] || 40;
  return {
    id: Math.random().toString(36).slice(2, 9),
    kind: 'axe', tier, rented,
    uses: rented ? config.axeRentMines : null,
    durability: rented ? config.axeRentMines : max,
    maxDurability: max,
    power: 0,
    enchants: {}
  };
}

function newRod(tier = 'wood') {
  return {
    id: Math.random().toString(36).slice(2, 9),
    kind: 'rod', tier, power: 0, enchants: {}
  };
}

function newSword(role = 'mage') {
  const def = SWORD_ROLES.find(s => s.role === role) || SWORD_ROLES[0];
  const max = 140;
  return {
    id: Math.random().toString(36).slice(2, 9),
    kind: 'sword', role: def.role, name: def.name,
    power: 0, durability: max, maxDurability: max, enchants: {}
  };
}

function newBook(type) {
  return {
    id: Math.random().toString(36).slice(2, 9),
    kind: 'book', type, level: randInt(1, 5)
  };
}

function getEquipped(u, kind) {
  const list = u.inventory[kind + 's'];
  const id = u.gear[kind];
  return list.find(x => x.id === id) || null;
}

function equip(u, kind, id) {
  const list = u.inventory[kind + 's'];
  const item = list.find(x => x.id === id);
  if (!item) return null;
  u.gear[kind] = id;
  return item;
}

function enchantPower(item) {
  return (item.power || 0) + (item.enchants?.power || 0);
}

function miningYield(u, perfect) {
  const axe = getEquipped(u, 'axe');
  if (!axe) return { error: 'You need an equipped axe! Use `.shop` to buy or rent one.' };
  if (axe.rented) {
    if (axe.uses <= 0) return { error: 'Your rented axe is broken! Rent or buy a new one.' };
    axe.uses--;
    axe.durability = axe.uses;
    if (axe.uses <= 0) {
      u.inventory.axes = u.inventory.axes.filter(a => a.id !== axe.id);
      u.gear.axe = null;
    }
  } else {
    const wear = perfect ? 2 : 3;
    axe.durability -= wear;
    if (axe.durability <= 0) {
      u.inventory.axes = u.inventory.axes.filter(a => a.id !== axe.id);
      u.gear.axe = null;
      return { broken: true, loot: {} };
    }
  }

  const power = enchantPower(axe) + (axe.enchants?.luck || 0) * 2;
  const rolls = perfect ? 2 + Math.floor(power / 4) : 1 + Math.floor(power / 8);
  const loot = {};
  for (let i = 0; i < rolls; i++) {
    const tierRoll = Math.random() + power * 0.012;
    let mat;
    if (tierRoll > 0.97) mat = 'special';
    else if (tierRoll > 0.88) mat = 'netherite';
    else if (tierRoll > 0.72) mat = 'diamond';
    else if (tierRoll > 0.50) mat = 'iron';
    else if (tierRoll > 0.30) mat = 'copper';
    else mat = pick(['stone', 'dirt', 'sand', 'gravel']);
    loot[mat] = (loot[mat] || 0) + randInt(1, perfect ? 3 : 2);
  }
  for (const [k, v] of Object.entries(loot)) {
    u.inventory.materials[k] = (u.inventory.materials[k] || 0) + v;
  }
  return { loot };
}

function fishingYield(u, perfect) {
  const rod = getEquipped(u, 'rod');
  if (!rod) return { error: 'You need an equipped fishing rod! Use `.shop` to buy one.' };
  const power = enchantPower(rod) + (rod.enchants?.luck || 0) * 2;
  const rare = Math.random() < 0.05 + power * 0.01 + (perfect ? 0.15 : 0);
  const key = rare ? 'rarefish' : 'fish';
  const count = perfect ? randInt(2, 4) : randInt(1, 2);
  u.inventory.materials[key] = (u.inventory.materials[key] || 0) + count;
  return { loot: { [key]: count } };
}

function repairAxe(u, index) {
  const axe = u.inventory.axes[index];
  if (!axe) return { error: 'Axe not found.' };
  if (axe.rented) return { error: 'Rented axes cannot be repaired — they break after 10 mines.' };
  const cost = config.repairCost[axe.tier] || 4;
  const mat = axe.tier;
  if ((u.inventory.materials[mat] || 0) < cost) {
    return { error: `You need ${cost} ${mat} to repair this ${axe.tier} axe.` };
  }
  u.inventory.materials[mat] -= cost;
  axe.durability = axe.maxDurability;
  return { ok: true, cost, mat };
}

function combineAxes(u, i, j) {
  const a = u.inventory.axes[i], b = u.inventory.axes[j];
  if (!a || !b || i === j) return { error: 'Need two different axes.' };
  if (a.rented || b.rented) return { error: 'Rented axes cannot be combined.' };
  if (a.tier !== b.tier) return { error: 'Both axes must be the same tier.' };
  const result = {
    ...a,
    power: Math.max(a.power, b.power),
    durability: a.maxDurability,
    enchants: { ...a.enchants }
  };
  const removed = new Set([i, j].sort((x, y) => y - x));
  removed.forEach(idx => u.inventory.axes.splice(idx, 1));
  u.inventory.axes.push(result);
  u.gear.axe = result.id;
  return { ok: true, axe: result };
}

function upgradePower(u, kind, index) {
  const list = u.inventory[kind + 's'];
  const item = list[index];
  if (!item) return { error: 'Item not found.' };
  const key = kind + 'Power';
  if ((u.upgrades[key] || 0) >= config.axePowerMax) return { error: 'Already at maximum +16 power.' };
  const cost = 800 + (item.power + 1) * 450;
  if (u.cash < cost) return { error: `Need $${cost} to upgrade.` };
  u.cash -= cost;
  item.power += 1;
  u.upgrades[key] = item.power;
  return { ok: true, cost, power: item.power };
}

function enchantItem(u, kind, itemIndex, bookIndex) {
  const item = u.inventory[kind + 's'][itemIndex];
  const book = u.inventory.books[bookIndex];
  if (!item || !book) return { error: 'Item or book not found.' };
  item.enchants = item.enchants || {};
  item.enchants[book.type] = Math.min(16, (item.enchants[book.type] || 0) + book.level);
  u.inventory.books.splice(bookIndex, 1);
  return { ok: true, type: book.type, level: item.enchants[book.type] };
}

function lootBoxReward(u) {
  const rewards = [];
  const roll = Math.random();
  if (roll < 0.30) {
    const axe = newAxe(pick(AXE_TIERS));
    u.inventory.axes.push(axe);
    rewards.push(`${axe.tier} axe`);
  } else if (roll < 0.55) {
    const rod = newRod(pick(ROD_TIERS));
    u.inventory.rods.push(rod);
    rewards.push(`${rod.tier} rod`);
  } else if (roll < 0.75) {
    const book = newBook(pick(BOOKS));
    u.inventory.books.push(book);
    rewards.push(`${book.type} book (+${book.level})`);
  } else if (roll < 0.90) {
    const sword = newSword(pick(SWORD_ROLES).role);
    u.inventory.swords.push(sword);
    rewards.push(`${sword.name} (${sword.role})`);
  } else {
    const amount = randInt(300, 1500);
    u.cash += amount;
    rewards.push(`$${amount}`);
  }
  return rewards;
}

function sellValue(u) {
  let total = 0;
  for (const [k, v] of Object.entries(u.inventory.materials)) {
    total += (config.materialValue[k] || 0) * v;
  }
  return total;
}

function sellAll(u) {
  const total = sellValue(u);
  if (total <= 0) return 0;
  for (const k of Object.keys(u.inventory.materials)) u.inventory.materials[k] = 0;
  u.cash += total;
  u.stats.earned += total;
  return total;
}

module.exports = {
  AXE_TIERS, ROD_TIERS, SWORD_ROLES, BOOKS, MATERIALS, FISH,
  newAxe, newRod, newSword, newBook, getEquipped, equip,
  enchantPower, miningYield, fishingYield, repairAxe, combineAxes,
  upgradePower, enchantItem, lootBoxReward, sellValue, sellAll
};
