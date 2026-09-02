// scripts/gtm-add-events.ts
//
// Adds the three login events to the txtconv Tag Manager container and
// publishes a new version. Safe to run again: every step checks first.
//
// Usage:
//   GTM_TOKEN=$(gcloud auth print-access-token \
//     local-dev-agent@ups-side-projects.iam.gserviceaccount.com \
//     --scopes=https://www.googleapis.com/auth/tagmanager.readonly,https://www.googleapis.com/auth/tagmanager.edit.containers,https://www.googleapis.com/auth/tagmanager.edit.containerversions,https://www.googleapis.com/auth/tagmanager.publish)
//   npx --yes tsx scripts/gtm-add-events.ts            # apply and publish
//   npx --yes tsx scripts/gtm-add-events.ts --dry-run  # only print what would change
import 'dotenv/config';
import {
  addSettingsRows,
  extendEventRegex,
  pickWorkspace,
  stripReadOnly,
  type GtmParameter,
  type ParamMapping,
} from './gtm-add-events.helpers';

const TOKEN = process.env.GTM_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');

const BASE = 'https://tagmanager.googleapis.com/tagmanager/v2';
const PARENT = 'accounts/6364290968/containers/257354615';
const TRIGGER_NAME = 'CE - product & funnel events';
const EVENT_TAG_NAME = 'GA4 event - forward dataLayer events';
const NEW_EVENTS = ['login_started', 'login_succeeded', 'login_failed'];
// dataLayer key -> GA4 parameter. The GA4 custom dimensions use the GA4 names.
const NEW_PARAMS: ParamMapping[] = [
  { dataLayerKey: 'method', ga4Param: 'login_method' },
  { dataLayerKey: 'reason', ga4Param: 'login_failure_reason' },
];

interface Named { name: string; path: string; fingerprint: string }
interface Trigger extends Named { customEventFilter?: Array<{ type: string; parameter: GtmParameter[] }> }
interface Tag extends Named { parameter: GtmParameter[] }

/** One Tag Manager API call. Throws with the response body on any HTTP error. */
async function call<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403) {
      console.error('\nThe service account lacks permission on this container.');
      console.error('Hand the manual checklist in the plan to the owner instead.\n');
    }
    throw new Error(`HTTP ${res.status} on ${method} ${path}: ${text.slice(0, 500)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

async function main() {
  if (!TOKEN) {
    console.error('GTM_TOKEN is not set. See the usage note at the top of this file.');
    process.exit(1);
  }

  const { workspace } = await call<{ workspace: Named[] }>('GET', `${PARENT}/workspaces`);
  const ws = pickWorkspace(workspace).path;
  console.log(`workspace: ${ws}${DRY_RUN ? '  (dry run)' : ''}`);
  let changed = false;

  // 1. Data-layer variables for the new parameters
  const { variable = [] } = await call<{ variable?: Named[] }>('GET', `${ws}/variables`);
  const existingVars = new Set(variable.map((v) => v.name));
  for (const { dataLayerKey } of NEW_PARAMS) {
    const name = `DLV - ${dataLayerKey}`;
    if (existingVars.has(name)) {
      console.log(`variable exists: ${name}`);
      continue;
    }
    console.log(`create variable: ${name}`);
    changed = true;
    if (DRY_RUN) continue;
    await call('POST', `${ws}/variables`, {
      name,
      type: 'v',
      parameter: [
        { type: 'integer', key: 'dataLayerVersion', value: '2' },
        { type: 'template', key: 'name', value: dataLayerKey },
      ],
    });
  }

  // 2. Trigger: add the event names to the regex
  const { trigger = [] } = await call<{ trigger?: Trigger[] }>('GET', `${ws}/triggers`);
  const trig = trigger.find((t) => t.name === TRIGGER_NAME);
  if (!trig) throw new Error(`Trigger not found: ${TRIGGER_NAME}`);
  const regexParam = trig.customEventFilter?.[0]?.parameter.find((p) => p.key === 'arg1');
  if (!regexParam?.value) throw new Error(`Trigger ${TRIGGER_NAME} has no event regex`);
  const newRegex = extendEventRegex(regexParam.value, NEW_EVENTS);
  if (newRegex === regexParam.value) {
    console.log('trigger already lists the login events');
  } else {
    console.log(`update trigger regex -> ${newRegex}`);
    changed = true;
    if (!DRY_RUN) {
      regexParam.value = newRegex;
      await call('PUT', `${trig.path}?fingerprint=${trig.fingerprint}`, stripReadOnly(trig));
    }
  }

  // 3. Tag: map the new parameters
  const { tag = [] } = await call<{ tag?: Tag[] }>('GET', `${ws}/tags`);
  const eventTag = tag.find((t) => t.name === EVENT_TAG_NAME);
  if (!eventTag) throw new Error(`Tag not found: ${EVENT_TAG_NAME}`);
  const table = eventTag.parameter.find((p) => p.key === 'eventSettingsTable');
  if (!table?.list) throw new Error(`Tag ${EVENT_TAG_NAME} has no eventSettingsTable`);
  const { rows, added } = addSettingsRows(table.list, NEW_PARAMS);
  if (added.length === 0) {
    console.log('tag already maps the login parameters');
  } else {
    console.log(`add tag parameters: ${added.join(', ')}`);
    changed = true;
    if (!DRY_RUN) {
      table.list = rows;
      await call('PUT', `${eventTag.path}?fingerprint=${eventTag.fingerprint}`, stripReadOnly(eventTag));
    }
  }

  // 4. Version + publish, only when something changed
  if (!changed) {
    console.log('nothing to do; container already up to date');
    return;
  }
  if (DRY_RUN) {
    console.log('dry run: would create and publish a new version');
    return;
  }
  const version = await call<{ containerVersion: { path: string; name: string }; compilerError?: boolean }>(
    'POST',
    `${ws}:create_version`,
    {
      name: `login events ${new Date().toISOString().slice(0, 10)}`,
      notes: 'Forward login_started / login_succeeded / login_failed with login_method and login_failure_reason',
    }
  );
  if (version.compilerError) throw new Error('Version has compiler errors; nothing was published');
  console.log(`created version: ${version.containerVersion.path}`);
  await call('POST', `${version.containerVersion.path}:publish`);
  console.log(`published: ${version.containerVersion.name}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
