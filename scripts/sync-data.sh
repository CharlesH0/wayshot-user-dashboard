#!/bin/bash
# Sync PostHog data to local JSON cache
# Run via cron: 0 1 * * * /root/.openclaw/workspace/projects/wayshot-user-dashboard/scripts/sync-data.sh

set -e

API_HOST="${POSTHOG_HOST:-https://us.posthog.com}"
PROJECT_ID="${POSTHOG_PROJECT_ID:-195843}"
API_KEY="${POSTHOG_API_KEY}"

if [ -z "$API_KEY" ]; then
  # Load from .env file
  ENV_FILE="$(dirname "$0")/../.env"
  if [ -f "$ENV_FILE" ]; then
    API_KEY=$(grep VITE_POSTHOG_API_KEY "$ENV_FILE" | cut -d= -f2)
    PROJECT_ID=$(grep VITE_POSTHOG_PROJECT_ID "$ENV_FILE" | cut -d= -f2- || echo "$PROJECT_ID")
    API_HOST=$(grep VITE_POSTHOG_HOST "$ENV_FILE" | cut -d= -f2- || echo "$API_HOST")
  fi
fi

if [ -z "$API_KEY" ]; then
  echo "ERROR: No PostHog API key found. Set POSTHOG_API_KEY or create .env file."
  exit 1
fi
DATA_DIR="/root/.openclaw/workspace/projects/wayshot-user-dashboard/public/data"

mkdir -p "$DATA_DIR"

hogql() {
  local query="$1"
  local payload
  payload=$(jq -nc --arg q "$query" '{"query":{"kind":"HogQLQuery","query":$q}}')
  curl -s -X POST "${API_HOST}/api/projects/${PROJECT_ID}/query/" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

echo "[$(date)] Starting PostHog data sync..."

# 1. Fetch all persons with subscription status (with distinct_id via join)
echo "Fetching persons..."
hogql 'SELECT pdi.distinct_id, properties.rc_subscription_status as status, properties.$geoip_country_name as country, properties.$geoip_country_code as country_code FROM persons INNER JOIN person_distinct_ids pdi ON pdi.person_id = id WHERE properties.rc_subscription_status IS NOT NULL LIMIT 5000' > /tmp/ph_persons.json

# 2. Fetch payment events (all time) - distinct_id, event, timestamp, product_id, revenue
echo "Fetching payment events..."
hogql "SELECT distinct_id, event, timestamp, properties.product_id as product_id, properties.revenue as revenue FROM events WHERE event IN ('rc_initial_purchase_event','rc_trial_converted_event','rc_renewal_event','rc_non_subscription_purchase_event') ORDER BY timestamp DESC LIMIT 10000" > /tmp/ph_payments.json

# 3. Fetch latest device model per user
echo "Fetching device info..."
hogql 'SELECT distinct_id, properties.$device_model FROM events WHERE event IN ('"'"'app_opened'"'"', '"'"'photo_taken'"'"') AND timestamp > now() - INTERVAL 90 DAY AND properties.$device_model IS NOT NULL ORDER BY timestamp DESC LIMIT 20000' > /tmp/ph_devices.json

# 4. Fetch behavior events (last 30 days) — only for paying users
echo "Fetching behavior stats (30d, paying users only)..."
hogql "SELECT e.distinct_id, e.event, count() as cnt FROM events e INNER JOIN person_distinct_ids pdi ON pdi.distinct_id = e.distinct_id INNER JOIN persons p ON p.id = pdi.person_id WHERE e.event IN ('photo_taken','ai_framing_on','ai_voice_play','app_activated','final_page_save_success','home_reimagine_click') AND e.timestamp > now() - INTERVAL 30 DAY AND p.properties.rc_subscription_status IS NOT NULL GROUP BY e.distinct_id, e.event LIMIT 50000" > /tmp/ph_behaviors.json

# 4b. Fetch behavior events (all time) — only for users with subscription status (paying users)
echo "Fetching behavior stats (all time, paying users only)..."
hogql "SELECT e.distinct_id, e.event, count() as cnt FROM events e INNER JOIN person_distinct_ids pdi ON pdi.distinct_id = e.distinct_id INNER JOIN persons p ON p.id = pdi.person_id WHERE e.event IN ('photo_taken','ai_framing_on','ai_voice_play','app_activated','final_page_save_success','home_reimagine_click') AND p.properties.rc_subscription_status IS NOT NULL GROUP BY e.distinct_id, e.event LIMIT 50000" > /tmp/ph_behaviors_all.json

# 5. Process into groups using node
echo "Processing data..."
node -e "
const fs = require('fs');

const persons = JSON.parse(fs.readFileSync('/tmp/ph_persons.json', 'utf8'));
const payments = JSON.parse(fs.readFileSync('/tmp/ph_payments.json', 'utf8'));
const devices = JSON.parse(fs.readFileSync('/tmp/ph_devices.json', 'utf8'));

const behaviors = JSON.parse(fs.readFileSync('/tmp/ph_behaviors.json', 'utf8'));
const behaviorsAll = JSON.parse(fs.readFileSync('/tmp/ph_behaviors_all.json', 'utf8'));

const personRows = persons.results || [];
const paymentRows = payments.results || [];
const deviceRows = devices.results || [];
const behaviorRows = behaviors.results || [];
const behaviorAllRows = behaviorsAll.results || [];

// Build device map (first occurrence = latest due to ORDER BY timestamp DESC)
const deviceMap = {};
for (const [did, model] of deviceRows) {
  if (!deviceMap[did] && model) deviceMap[did] = model;
}

// Build payment counts and latest product per user
const payCounts = {};
const latestProduct = {};
const totalRevenue = {};
const paymentHistory = {};

for (const [did, event, ts, pid, rev] of paymentRows) {
  payCounts[did] = (payCounts[did] || 0) + 1;
  totalRevenue[did] = (totalRevenue[did] || 0) + (parseFloat(rev) || 0);
  if (!latestProduct[did]) latestProduct[did] = pid || '';
  if (!paymentHistory[did]) paymentHistory[did] = [];
  paymentHistory[did].push({ event, time: ts, productId: pid || '', revenue: parseFloat(rev) || 0 });
}

// Build behavior stats per user (last 30 days)
const userBehaviors = {};
for (const [did, event, cnt] of behaviorRows) {
  if (!userBehaviors[did]) userBehaviors[did] = {};
  userBehaviors[did][event] = parseInt(cnt) || 0;
}

// Build all-time behavior stats per user
const userBehaviorsAll = {};
for (const [did, event, cnt] of behaviorAllRows) {
  if (!userBehaviorsAll[did]) userBehaviorsAll[did] = {};
  userBehaviorsAll[did][event] = parseInt(cnt) || 0;
}

// Categorize users — all paying users regardless of subscription status
const highValue = [];
const annual = [];
const other = [];

for (const [did, status, country, countryCode] of personRows) {
  const cnt = payCounts[did] || 0;
  if (cnt === 0) continue; // skip users with no payment history
  const rev = totalRevenue[did] || 0;
  const pid = (latestProduct[did] || '').toLowerCase();
  const isYearly = pid.includes('yearly') || pid.includes('annual') || pid.includes('year');
  const device = deviceMap[did] || '';

  const beh = userBehaviors[did] || {};
  const behAll = userBehaviorsAll[did] || {};
  const user = { id: did, status, payCount: cnt, revenue: Math.round(rev * 100) / 100, productId: latestProduct[did] || '', country: country || '', countryCode: countryCode || '', device, behaviors: beh, behaviorsAll: behAll };

  if (cnt > 5) {
    highValue.push(user);
  } else if (isYearly) {
    annual.push(user);
  } else {
    other.push(user);
  }
}

// Sort by revenue descending
[highValue, annual, other].forEach(arr => arr.sort((a, b) => b.revenue - a.revenue));

const output = {
  updatedAt: new Date().toISOString(),
  groups: { highValue, annual, other },
  paymentHistory
};

fs.writeFileSync('${DATA_DIR}/users.json', JSON.stringify(output));
console.log('High-value:', highValue.length, 'Annual:', annual.length, 'Other:', other.length);
"

echo "[$(date)] Sync complete. Output: ${DATA_DIR}/users.json"
ls -la "${DATA_DIR}/users.json"
