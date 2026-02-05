/**
 * Test user configuration for development testing.
 * NEVER use in production - guarded by environment checks.
 */

export const TEST_USER_ID = 'test-user-00000000-0000-0000-0000-000000000001';

/**
 * Comprehensive custom dictionary entries that DIFFER from OpenCC defaults.
 * This allows verifying that custom dict is actually being applied.
 *
 * Format: simplified → custom traditional (different from OpenCC s2twp)
 *
 * OpenCC s2twp defaults shown in comments for comparison.
 */
export const TEST_CUSTOM_DICT_CSV = `软件,軟體程式
硬件,硬體裝置
内存,記憶體空間
信息,訊息通知
网络,網際網路
数据,資料數據
程序,程式程序
文件,文件檔案
视频,視訊影片
音频,音訊聲音`;

/**
 * Parsed version of the test dictionary for direct use.
 */
export const TEST_CUSTOM_DICT_PAIRS = [
  { simplified: '软件', traditional: '軟體程式' },      // OpenCC: 軟體
  { simplified: '硬件', traditional: '硬體裝置' },      // OpenCC: 硬體
  { simplified: '内存', traditional: '記憶體空間' },    // OpenCC: 記憶體
  { simplified: '信息', traditional: '訊息通知' },      // OpenCC: 資訊
  { simplified: '网络', traditional: '網際網路' },      // OpenCC: 網路
  { simplified: '数据', traditional: '資料數據' },      // OpenCC: 資料
  { simplified: '程序', traditional: '程式程序' },      // OpenCC: 程式
  { simplified: '文件', traditional: '文件檔案' },      // OpenCC: 檔案
  { simplified: '视频', traditional: '視訊影片' },      // OpenCC: 視訊
  { simplified: '音频', traditional: '音訊聲音' },      // OpenCC: 音訊
];

/**
 * Expected conversions for test verification.
 * Use these to verify custom dict is applied, not OpenCC defaults.
 */
export const TEST_CONVERSIONS = {
  // Input → Expected with custom dict (vs OpenCC default)
  '软件测试': '軟體程式測試',           // OpenCC would give: 軟體測試
  '硬件设备': '硬體裝置設備',           // OpenCC would give: 硬體裝置
  '网络信息': '網際網路訊息通知',       // OpenCC would give: 網路資訊
};
