// mirrors REWARD_TIERS in the frontend's Rewards modal — the server is the
// authority on cost/value, the client only renders them
const REWARD_TIERS = [
  { id: "r5", cost: 150, kind: "pct", value: 5, label: "ส่วนลด 5%" },
  { id: "r10", cost: 400, kind: "pct", value: 10, label: "ส่วนลด 10%" },
  { id: "b250", cost: 700, kind: "baht", value: 250, label: "ส่วนลด ฿250" },
  { id: "r15", cost: 1000, kind: "pct", value: 15, label: "ส่วนลด 15%" },
  { id: "r20", cost: 1600, kind: "pct", value: 20, label: "ส่วนลด 20%" },
  { id: "r30", cost: 2600, kind: "pct", value: 30, label: "ส่วนลด 30%" },
];

// 1 point per ฿20 spent, same rate the booking form shows
const BAHT_PER_POINT = 20;

module.exports = { REWARD_TIERS, BAHT_PER_POINT };
