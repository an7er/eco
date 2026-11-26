const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  cash INTEGER NOT NULL DEFAULT 1000,
  bank INTEGER NOT NULL DEFAULT 0,
  inventory TEXT NOT NULL,
  cooldowns TEXT NOT NULL,
  stats TEXT NOT NULL,
  gear TEXT NOT NULL,
  upgrades TEXT NOT NULL,
  voice TEXT NOT NULL,
  quests TEXT NOT NULL,
  business TEXT,
  pet TEXT,
  house TEXT,
  farm TEXT,
  title TEXT NOT NULL DEFAULT '',
  insuranceUntil INTEGER NOT NULL DEFAULT 0,
  jailUntil INTEGER NOT NULL DEFAULT 0,
  notify INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT NOT NULL,
  time INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS shop_items (
  name TEXT PRIMARY KEY,
  price INTEGER NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lottery (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pool INTEGER NOT NULL DEFAULT 0,
  entries TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS duels (
  id TEXT PRIMARY KEY,
  challenger TEXT NOT NULL,
  target TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL
);
`);

function defaults(id) {
  return {
    id,
    cash: config.startCash,
    bank: 0,
    inventory: {
      materials: {
        stone: 0, dirt: 0, sand: 0, gravel: 0,
        copper: 0, iron: 0, diamond: 0, netherite: 0,
        special: 0, fish: 0, rarefish: 0
      },
      axes: [], rods: [], swords: [], books: [], items: []
    },
    cooldowns: {},
    stats: {
      earned: 0, spent: 0, won: 0, lost: 0,
      dropsClaimed: 0, streak: 0, streakTotal: 0,
      flagStreak: 0, flagStreakTotal: 0, boxStreak: 0, boxStreakTotal: 0,
      robWins: 0, crimes: 0, dungeonWins: 0
    },
    gear: { axe: null, rod: null, sword: null },
    upgrades: { axePower: 0, rodPower: 0, swordPower: 0 },
    voice: { seconds: 0, day: '', claimed30: false, claimed60: false },
    quests: {},
    business: null, pet: null, house: null, farm: null,
    title: '', insuranceUntil: 0, jailUntil: 0, notify: 0
  };
}

const parse = v => { try { return JSON.parse(v); } catch { return {}; } };

function getUser(id) {
  let row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) {
    const u = defaults(id);
    db.prepare(`INSERT INTO users
      (id,cash,bank,inventory,cooldowns,stats,gear,upgrades,voice,quests,business,pet,house,farm,title,insuranceUntil,jailUntil,notify)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(u.id, u.cash, u.bank, JSON.stringify(u.inventory), JSON.stringify(u.cooldowns),
        JSON.stringify(u.stats), JSON.stringify(u.gear), JSON.stringify(u.upgrades),
        JSON.stringify(u.voice), JSON.stringify(u.quests), null, null, null, null, '', 0, 0, 0);
    row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
  return {
    id: row.id, cash: row.cash, bank: row.bank,
    inventory: parse(row.inventory), cooldowns: parse(row.cooldowns),
    stats: parse(row.stats), gear: parse(row.gear), upgrades: parse(row.upgrades),
    voice: parse(row.voice), quests: parse(row.quests),
    business: row.business ? parse(row.business) : null,
    pet: row.pet ? parse(row.pet) : null,
    house: row.house ? parse(row.house) : null,
    farm: row.farm ? parse(row.farm) : null,
    title: row.title, insuranceUntil: row.insuranceUntil,
    jailUntil: row.jailUntil, notify: row.notify
  };
}

function saveUser(u) {
  db.prepare(`UPDATE users SET
    cash=?, bank=?, inventory=?, cooldowns=?, stats=?, gear=?, upgrades=?, voice=?,
    quests=?, business=?, pet=?, house=?, farm=?, title=?, insuranceUntil=?, jailUntil=?, notify=?
    WHERE id=?`).run(
    u.cash, u.bank, JSON.stringify(u.inventory), JSON.stringify(u.cooldowns),
    JSON.stringify(u.stats), JSON.stringify(u.gear), JSON.stringify(u.upgrades),
    JSON.stringify(u.voice), JSON.stringify(u.quests),
    u.business ? JSON.stringify(u.business) : null,
    u.pet ? JSON.stringify(u.pet) : null,
    u.house ? JSON.stringify(u.house) : null,
    u.farm ? JSON.stringify(u.farm) : null,
    u.title, u.insuranceUntil, u.jailUntil, u.notify, u.id
  );
}

function addTransaction(id, type, amount, note) {
  db.prepare('INSERT INTO transactions (user,type,amount,note,time) VALUES (?,?,?,?,?)')
    .run(id, type, amount, String(note), Date.now());
}

function getTransactions(id, limit = 10) {
  return db.prepare('SELECT * FROM transactions WHERE user=? ORDER BY id DESC LIMIT ?').all(id, limit);
}

function allUsers() {
  return db.prepare('SELECT id FROM users').all().map(r => r.id);
}

function getShop() {
  return db.prepare('SELECT * FROM shop_items').all().map(r => ({ ...r, data: parse(r.data) }));
}

function setShopItem(name, price, type, data) {
  db.prepare(`INSERT INTO shop_items (name,price,type,data) VALUES (?,?,?,?)
    ON CONFLICT(name) DO UPDATE SET price=excluded.price,type=excluded.type,data=excluded.data`)
    .run(name, price, type, JSON.stringify(data || {}));
}

function seedShop() {
  const items = [
    ['Loot Box', 750, 'lootbox', {}],
    ['Potion', 200, 'potion', { heal: 20 }],
    ['Loot Box Key', 300, 'key', {}],
    ['Copper Axe (rent)', 100, 'axe_rent', { tier: 'copper' }],
    ['Iron Axe (rent)', 250, 'axe_rent', { tier: 'iron' }],
    ['Copper Axe', 900, 'axe_buy', { tier: 'copper' }],
    ['Iron Axe', 2200, 'axe_buy', { tier: 'iron' }],
    ['Diamond Axe', 6000, 'axe_buy', { tier: 'diamond' }],
    ['Netherite Axe', 15000, 'axe_buy', { tier: 'netherite' }],
    ['Wood Rod', 500, 'rod_buy', { tier: 'wood' }],
    ['Iron Rod', 1800, 'rod_buy', { tier: 'iron' }],
    ['Diamond Rod', 5000, 'rod_buy', { tier: 'diamond' }],
    ['Netherite Rod', 12000, 'rod_buy', { tier: 'netherite' }],
    ['Enchant Book: Luck', 1200, 'book', { type: 'luck' }],
    ['Enchant Book: Durability', 1200, 'book', { type: 'durability' }],
    ['Enchant Book: Power', 1500, 'book', { type: 'power' }],
    ['Enchant Book: Critical', 1500, 'book', { type: 'critical' }],
    ['Insurance (1h)', 900, 'insurance', {}],
    ['Bail Card', 700, 'bail', {}],
    ['Business: Lemon Stand', 5000, 'business', { rate: 60 }],
    ['Pet: Wolf', 3500, 'pet', { rate: 40 }],
    ['House: Cottage', 8000, 'house', { rate: 90 }],
    ['Farm Plot', 4500, 'farm', { rate: 75 }]
  ];
  const stmt = db.prepare(`INSERT OR IGNORE INTO shop_items (name,price,type,data) VALUES (?,?,?,?)`);
  items.forEach(i => stmt.run(i[0], i[1], i[2], JSON.stringify(i[3])));
}

seedShop();

module.exports = {
  db, getUser, saveUser, addTransaction, getTransactions,
  allUsers, getShop, setShopItem
};
