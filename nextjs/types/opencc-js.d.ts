declare module 'opencc-js' {
  export function ConverterFactory(from: any, to: any): (text: string) => string;
  export function Converter(config: { from: string; to: string }): (text: string) => string;
}

declare module 'opencc-js/preset' {
  export const from: {
    cn: any;
    hk: any;
    tw: any;
    twp: any;
    jp: any;
  };
  export const to: {
    cn: any;
    hk: any;
    tw: any;
    twp: any;
    jp: any;
  };
}
