import {
  extendEventRegex,
  addSettingsRows,
  stripReadOnly,
  type GtmParameter,
} from '@/scripts/gtm-add-events.helpers';

describe('extendEventRegex', () => {
  it('appends missing events inside the anchored group', () => {
    expect(extendEventRegex('^(a|b)$', ['b', 'c', 'd'])).toBe('^(a|b|c|d)$');
  });

  it('is idempotent', () => {
    const once = extendEventRegex('^(a)$', ['x']);
    expect(extendEventRegex(once, ['x'])).toBe(once);
  });

  it('refuses a regex it does not understand', () => {
    expect(() => extendEventRegex('a|b', ['c'])).toThrow(/Unexpected trigger regex/);
  });
});

describe('addSettingsRows', () => {
  const row = (parameter: string, value: string): GtmParameter => ({
    type: 'map',
    map: [
      { type: 'template', key: 'parameter', value: parameter },
      { type: 'template', key: 'parameterValue', value },
    ],
  });

  it('adds one row per missing GA4 parameter, reading the given dataLayer key', () => {
    const { rows, added } = addSettingsRows(
      [row('source_path', '{{DLV - source_path}}')],
      [
        { dataLayerKey: 'method', ga4Param: 'login_method' },
        { dataLayerKey: 'reason', ga4Param: 'login_failure_reason' },
      ]
    );
    expect(added).toEqual(['login_method', 'login_failure_reason']);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(row('login_method', '{{DLV - method}}'));
    expect(rows[2]).toEqual(row('login_failure_reason', '{{DLV - reason}}'));
  });

  it('skips parameters that already exist and does not mutate the input', () => {
    const input = [row('login_method', '{{DLV - method}}')];
    const { rows, added } = addSettingsRows(input, [{ dataLayerKey: 'method', ga4Param: 'login_method' }]);
    expect(added).toEqual([]);
    expect(rows).toEqual(input);
    expect(rows).not.toBe(input);
  });
});

describe('stripReadOnly', () => {
  it('drops the fields the API refuses in a PUT body', () => {
    expect(
      stripReadOnly({
        name: 't',
        type: 'gaawe',
        parameter: [],
        path: 'accounts/1/containers/2/workspaces/3/tags/4',
        accountId: '1',
        containerId: '2',
        workspaceId: '3',
        tagId: '4',
        fingerprint: '123',
        tagManagerUrl: 'https://tagmanager.google.com/#/x',
      })
    ).toEqual({ name: 't', type: 'gaawe', parameter: [] });
  });
});
