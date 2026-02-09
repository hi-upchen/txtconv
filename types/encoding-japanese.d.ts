declare module 'encoding-japanese' {
  export type EncodingName =
    | 'UTF8'
    | 'UTF16'
    | 'UTF16BE'
    | 'UTF16LE'
    | 'UTF32'
    | 'UNICODE'
    | 'BINARY'
    | 'ASCII'
    | 'JIS'
    | 'EUCJP'
    | 'SJIS'
    | 'GB2312'
    | 'GB18030'
    | 'GBK'
    | 'BIG5'
    | 'AUTO';

  export interface ConvertOptions {
    to: EncodingName;
    from?: EncodingName;
    type?: 'string' | 'array' | 'arraybuffer';
    bom?: boolean | 'auto';
    fallback?: 'error' | 'html-entity' | 'html-entity-hex' | 'ignore';
  }

  export function detect(data: Uint8Array | number[] | string): EncodingName | false;
  export function convert(
    data: Uint8Array | number[] | string,
    options: ConvertOptions
  ): number[] | string | Uint8Array;
  export function codeToString(codeArray: number[] | Uint8Array): string;
  export function stringToCode(str: string): number[];
}
