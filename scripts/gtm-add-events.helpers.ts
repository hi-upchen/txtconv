// scripts/gtm-add-events.helpers.ts

/** One entry of a Tag Manager parameter tree. */
export interface GtmParameter {
  type: string;
  key?: string;
  value?: string;
  list?: GtmParameter[];
  map?: GtmParameter[];
}

/** The workspace name Tag Manager gives every container by default. */
export const DEFAULT_WORKSPACE_NAME = 'Default Workspace';

/**
 * Picks the workspace to act on out of every workspace in the container.
 * Prefers the one named "Default Workspace". Falls back to the only
 * workspace when there is exactly one. Throws when neither rule picks
 * a single workspace, so a second workspace never gets changed by accident.
 */
export function pickWorkspace<T extends { name: string }>(workspaces: T[]): T {
  const byDefaultName = workspaces.find((w) => w.name === DEFAULT_WORKSPACE_NAME);
  if (byDefaultName) return byDefaultName;

  if (workspaces.length === 1) return workspaces[0];

  const names = workspaces.map((w) => w.name).join(', ');
  throw new Error(
    `Cannot pick a workspace: no workspace named "${DEFAULT_WORKSPACE_NAME}" and more than one exists (${names}). ` +
      'Pass the intended workspace explicitly instead of guessing.'
  );
}

/** Maps a dataLayer key to the GA4 event parameter name it is sent as. */
export interface ParamMapping {
  dataLayerKey: string;
  ga4Param: string;
}

/**
 * Adds event names to a custom-event trigger regex of the form ^(a|b)$.
 * Names already present are left alone, so running twice changes nothing.
 */
export function extendEventRegex(regex: string, events: string[]): string {
  const match = /^\^\((.*)\)\$$/.exec(regex);
  if (!match) throw new Error(`Unexpected trigger regex shape: ${regex}`);
  const existing = match[1].split('|');
  const merged = [...existing, ...events.filter((e) => !existing.includes(e))];
  return `^(${merged.join('|')})$`;
}

/**
 * Appends event-parameter rows to a GA4 event tag's settings table.
 * Each row sends {{DLV - <dataLayerKey>}} as the GA4 parameter <ga4Param>.
 * Rows whose GA4 parameter already exists are skipped.
 */
export function addSettingsRows(
  rows: GtmParameter[],
  params: ParamMapping[]
): { rows: GtmParameter[]; added: string[] } {
  const present = new Set(
    rows.map((row) => row.map?.find((entry) => entry.key === 'parameter')?.value)
  );
  const next = [...rows];
  const added: string[] = [];
  for (const { dataLayerKey, ga4Param } of params) {
    if (present.has(ga4Param)) continue;
    next.push({
      type: 'map',
      map: [
        { type: 'template', key: 'parameter', value: ga4Param },
        { type: 'template', key: 'parameterValue', value: `{{DLV - ${dataLayerKey}}}` },
      ],
    });
    added.push(ga4Param);
  }
  return { rows: next, added };
}

const READ_ONLY_FIELDS = [
  'path',
  'accountId',
  'containerId',
  'workspaceId',
  'tagId',
  'triggerId',
  'variableId',
  'fingerprint',
  'tagManagerUrl',
];

/** Returns a copy of a fetched resource without the server-managed fields. */
export function stripReadOnly<T extends object>(resource: T): Partial<T> {
  const copy = { ...resource } as Record<string, unknown>;
  for (const field of READ_ONLY_FIELDS) delete copy[field];
  return copy as Partial<T>;
}
