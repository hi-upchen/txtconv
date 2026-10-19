// __tests__/lib/payment/ecpay.test.ts
/**
 * ECPay CheckMacValue conformance tests.
 *
 * The first test is the make-or-break one. It reproduces ECPay's own
 * documented worked example (https://developers.ecpay.com.tw/?p=2902).
 * If the signature logic drifts, this fails, and no real payment would verify.
 */

import {
  buildCheckMacValue,
  buildPreHashString,
  buildCheckoutParams,
  verifyCallback,
} from '@/lib/payment/ecpay';

// The exact HashKey/HashIV and parameters from ECPay's official CheckMacValue
// example page. Do not "tidy" these. They are a fixed external contract.
const DOC_HASH_KEY = 'pwFHCqoQZGmho4w6';
const DOC_HASH_IV = 'EkRm7iFT261dpevs';

const DOC_PARAMS = {
  MerchantID: '3002607',
  MerchantTradeNo: 'ecpay20230312153023',
  MerchantTradeDate: '2023/03/12 15:30:23',
  PaymentType: 'aio',
  TotalAmount: '30000',
  TradeDesc: '促銷方案',
  ItemName: 'Apple iphone 15',
  ReturnURL: 'https://www.ecpay.com.tw/receive.php',
  ChoosePayment: 'ALL',
  EncryptType: '1',
};

const DOC_EXPECTED_MAC =
  '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840';

// ECPay's documented intermediate string, after URL-encode and lower-case.
// Asserting it pins the encoding separately from the hash.
const DOC_EXPECTED_PREHASH =
  'hashkey%3dpwfhcqoqzgmho4w6%26choosepayment%3dall%26encrypttype%3d1%26' +
  'itemname%3dapple+iphone+15%26merchantid%3d3002607%26merchanttradedate%3d' +
  '2023%2f03%2f12+15%3a30%3a23%26merchanttradeno%3decpay20230312153023%26' +
  'paymenttype%3daio%26returnurl%3dhttps%3a%2f%2fwww.ecpay.com.tw%2freceive.php' +
  '%26totalamount%3d30000%26tradedesc%3d%e4%bf%83%e9%8a%b7%e6%96%b9%e6%a1%88' +
  '%26hashiv%3dekrm7ift261dpevs';

// Public sandbox credentials without 3D. Used for the callback tests.
const SANDBOX_KEY = '5294y06JbISpM5x9';
const SANDBOX_IV = 'v77hoKGq4kWxNNIS';

describe('buildCheckMacValue — ECPay documented vector', () => {
  it('reproduces the official pre-hash string byte-for-byte', () => {
    expect(buildPreHashString(DOC_PARAMS, DOC_HASH_KEY, DOC_HASH_IV)).toBe(
      DOC_EXPECTED_PREHASH,
    );
  });

  it('reproduces the official CheckMacValue exactly', () => {
    expect(buildCheckMacValue(DOC_PARAMS, DOC_HASH_KEY, DOC_HASH_IV)).toBe(
      DOC_EXPECTED_MAC,
    );
  });

  it('is order-independent (sorting normalises input key order)', () => {
    const shuffled = {
      TradeDesc: '促銷方案',
      ChoosePayment: 'ALL',
      MerchantID: '3002607',
      ReturnURL: 'https://www.ecpay.com.tw/receive.php',
      EncryptType: '1',
      ItemName: 'Apple iphone 15',
      TotalAmount: '30000',
      PaymentType: 'aio',
      MerchantTradeDate: '2023/03/12 15:30:23',
      MerchantTradeNo: 'ecpay20230312153023',
    };
    expect(buildCheckMacValue(shuffled, DOC_HASH_KEY, DOC_HASH_IV)).toBe(
      DOC_EXPECTED_MAC,
    );
  });
});

describe('buildCheckoutParams', () => {
  it('produces a self-consistent, verifiable credit-card payload', () => {
    const params = buildCheckoutParams({
      merchantId: '2000132',
      merchantTradeNo: 'TCabc123def456ghi789',
      merchantTradeDate: '2026/09/02 00:05:09',
      totalAmount: 899,
      itemName: '簡轉繁 Pro 終身版',
      tradeDesc: 'txtconv Pro lifetime',
      returnURL: 'https://txtconv.arpuli.com/api/payment/ecpay/callback',
      orderResultURL: 'https://txtconv.arpuli.com/api/payment/ecpay/result',
      clientBackURL: 'https://txtconv.arpuli.com/checkout/complete?order=TCabc123def456ghi789',
      customField1: '0f7c1d6e-1c2b-4c3d-9e8f-123456789abc',
      hashKey: SANDBOX_KEY,
      hashIV: SANDBOX_IV,
    });

    expect(params.ChoosePayment).toBe('Credit');
    expect(params.EncryptType).toBe('1');
    expect(params.PaymentType).toBe('aio');
    expect(params.TotalAmount).toBe('899');
    expect(params.MerchantTradeNo).toBe('TCabc123def456ghi789');
    expect(params.ClientBackURL).toBe(
      'https://txtconv.arpuli.com/checkout/complete?order=TCabc123def456ghi789',
    );
    expect(params.CustomField1).toBe('0f7c1d6e-1c2b-4c3d-9e8f-123456789abc');
    // The generated signature must verify against itself.
    expect(verifyCallback(params, SANDBOX_KEY, SANDBOX_IV)).toBe(true);
  });
});

describe('verifyCallback', () => {
  function signedCallback(): Record<string, string> {
    const body: Record<string, string> = {
      MerchantID: '2000132',
      MerchantTradeNo: 'TCabc123def456ghi789',
      RtnCode: '1',
      RtnMsg: '交易成功',
      TradeAmt: '899',
      TradeNo: '2609020005091234',
      PaymentType: 'Credit_CreditCard',
      PaymentDate: '2026/09/02 00:07:00',
      SimulatePaid: '0',
    };
    body.CheckMacValue = buildCheckMacValue(body, SANDBOX_KEY, SANDBOX_IV);
    return body;
  }

  it('accepts a correctly signed payload', () => {
    expect(verifyCallback(signedCallback(), SANDBOX_KEY, SANDBOX_IV)).toBe(true);
  });

  it('rejects a tampered amount (signature does not match)', () => {
    const body = signedCallback();
    body.TradeAmt = '1';
    expect(verifyCallback(body, SANDBOX_KEY, SANDBOX_IV)).toBe(false);
  });

  it('rejects a tampered CheckMacValue', () => {
    const body = signedCallback();
    body.CheckMacValue = 'DEADBEEF';
    expect(verifyCallback(body, SANDBOX_KEY, SANDBOX_IV)).toBe(false);
  });

  it('rejects a payload with no CheckMacValue', () => {
    const body = signedCallback();
    delete body.CheckMacValue;
    expect(verifyCallback(body, SANDBOX_KEY, SANDBOX_IV)).toBe(false);
  });

  it('rejects a payload signed with the wrong key', () => {
    const body = signedCallback();
    expect(verifyCallback(body, 'wrongkeywrongkey', SANDBOX_IV)).toBe(false);
  });
});
