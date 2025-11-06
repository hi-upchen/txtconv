// Mock for opencc-js in tests
export const ConverterFactory = jest.fn((fromDict: any, toDict: any) => {
  // Simple mock converter that replaces some known characters for testing
  return (text: string) => {
    return text
      .replace(/简/g, '簡')
      .replace(/体/g, '體')
      .replace(/中文/g, '中文')
      .replace(/测试/g, '測試')
      .replace(/内容/g, '內容')
      .replace(/第一行/g, '第一行')
      .replace(/第二行/g, '第二行')
      .replace(/第三行/g, '第三行');
  };
});

// Mock preset module
export const mockPreset = {
  from: {
    cn: {},
    hk: {},
    tw: {},
    twp: {},
    jp: {},
  },
  to: {
    cn: {},
    hk: {},
    tw: {},
    twp: {},
    jp: {},
  },
};
