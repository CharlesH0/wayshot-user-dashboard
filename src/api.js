const API_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.posthog.com';
const PROJECT_ID = import.meta.env.VITE_POSTHOG_PROJECT_ID || '195843';
const API_KEY = import.meta.env.VITE_POSTHOG_API_KEY || '';

// ---- Cached data (pre-synced JSON) ----

let cachedData = null;

export async function loadCachedUsers() {
  if (cachedData) return cachedData;
  const res = await fetch('/data/users.json');
  if (!res.ok) throw new Error('无法加载用户数据缓存，请先运行 sync-data.sh');
  cachedData = await res.json();
  return cachedData;
}

// ---- Live PostHog queries (for user detail page) ----

async function hogql(query) {
  const res = await fetch(`${API_HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.results || [];
}

// Fetch all core events for a user (live query)
export async function fetchUserEvents(userId, limit = 1000) {
  const escaped = userId.replace(/'/g, "\\'");
  const q = `SELECT event, timestamp, properties.filter_name as filter_name, properties.product_id as product_id, properties.revenue as revenue FROM events WHERE distinct_id = '${escaped}' AND event IN ('photo_taken','home_reimagine_click','rc_initial_purchase_event','rc_trial_converted_event','rc_renewal_event','rc_non_subscription_purchase_event','final_page_save_success') ORDER BY timestamp DESC LIMIT ${limit}`;
  return hogql(q);
}

// Fetch daily counts for multiple events (live query)
export async function fetchMultiDailyCounts(userId, events, days = 30) {
  const escaped = userId.replace(/'/g, "\\'");
  const eventList = events.map(e => `'${e}'`).join(',');
  const q = `SELECT toDate(timestamp) as day, event, count() as count FROM events WHERE distinct_id = '${escaped}' AND event IN (${eventList}) AND timestamp >= now() - interval ${days} day GROUP BY day, event ORDER BY day`;
  return hogql(q);
}

// Fetch user person properties (live query)
export async function fetchUserProperties(userId) {
  const escaped = userId.replace(/'/g, "\\'");
  const q = `SELECT properties.rc_subscription_status, properties.rc_active_entitlements, properties.$initial_referring_domain, properties.$initial_utm_source FROM persons INNER JOIN person_distinct_ids pdi ON pdi.person_id = id WHERE pdi.distinct_id = '${escaped}' LIMIT 1`;
  const rows = await hogql(q);
  if (rows.length === 0) return null;
  const [status, entitlements, domain, utm] = rows[0];
  return { status, entitlements, domain, utm };
}
