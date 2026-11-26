const config = require('./config');
const db = require('./db');
const { money } = require('./utils');

function get(id) { return db.getUser(id); }
function save(u) { db.saveUser(u); }

function addCash(id, amount, type = 'earn', note = '') {
  const u = get(id);
  u.cash += amount;
  if (amount > 0) u.stats.earned += amount;
  else u.stats.spent += Math.abs(amount);
  save(u);
  db.addTransaction(id, type, amount, note);
  return u.cash;
}

function takeCash(id, amount, type = 'spend', note = '') {
  const u = get(id);
  if (u.cash < amount) return false;
  u.cash -= amount;
  u.stats.spent += amount;
  save(u);
  db.addTransaction(id, type, -amount, note);
  return true;
}

function transfer(from, to, amount) {
  const a = get(from);
  if (a.cash < amount) return false;
  a.cash -= amount;
  save(a);
  addCash(to, amount, 'donate', `from ${from}`);
  db.addTransaction(from, 'donate', -amount, `to ${to}`);
  return true;
}

function deposit(id, amount) {
  const u = get(id);
  if (u.cash < amount) return false;
  u.cash -= amount;
  u.bank += amount;
  save(u);
  db.addTransaction(id, 'deposit', -amount, 'cash -> bank');
  return true;
}

function withdraw(id, amount) {
  const u = get(id);
  if (u.bank < amount) return false;
  u.bank -= amount;
  u.cash += amount;
  save(u);
  db.addTransaction(id, 'withdraw', amount, 'bank -> cash');
  return true;
}

function onCooldown(u, key, duration) {
  const last = u.cooldowns[key] || 0;
  const left = duration - (Date.now() - last);
  return left > 0 ? left : 0;
}

function setCooldown(u, key) {
  u.cooldowns[key] = Date.now();
}

function netWorth(u) { return u.cash + u.bank; }

function leaderboard(limit = 10, weekly = false) {
  if (weekly) {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return db.db.prepare(
      'SELECT user AS id, SUM(amount) AS worth FROM transactions WHERE time >= ? AND amount > 0 GROUP BY user ORDER BY worth DESC LIMIT ?'
    ).all(since, limit);
  }
  const users = db.allUsers().map(id => {
    const u = get(id);
    return { id, worth: netWorth(u), cash: u.cash, bank: u.bank };
  });
  return users.sort((a, b) => b.worth - a.worth).slice(0, limit);
}

function taxAll(percent) {
  let total = 0;
  for (const id of db.allUsers()) {
    const u = get(id);
    const tax = Math.floor(u.cash * percent / 100);
    if (tax > 0) {
      u.cash -= tax;
      save(u);
      db.addTransaction(id, 'tax', -tax, `${percent}% tax`);
      total += tax;
    }
  }
  return total;
}

function inJail(u) { return u.jailUntil > Date.now(); }

function jail(u, ms) {
  u.jailUntil = Date.now() + ms;
  save(u);
}

function hasInsurance(u) { return u.insuranceUntil > Date.now(); }

module.exports = {
  get, save, addCash, takeCash, transfer, deposit, withdraw,
  onCooldown, setCooldown, netWorth, leaderboard, taxAll,
  inJail, jail, hasInsurance, money
};
