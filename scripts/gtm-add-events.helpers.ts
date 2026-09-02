// scripts/gtm-add-events.helpers.ts

/** One entry of a Tag Manager parameter tree. */
export interface GtmParameter {
  type: string;
  key?: string;
  value?: string;
  list?: GtmParameter[];
  map?: GtmParameter[];
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
