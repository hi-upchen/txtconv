'use client';

interface PricingSectionProps {
  gumroadUrl?: string;
}

const boxStyle = {
  backgroundColor: '#fff',
  color: '#363636',
};

const lifetimeBoxStyle = {
  backgroundColor: '#fffbeb',
  color: '#363636',
};

export default function PricingSection({
  gumroadUrl = 'https://gumroad.com/l/YOUR_PRODUCT_ID'
}: PricingSectionProps) {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <h2 className="title has-text-centered has-text-dark mb-6">方案價格</h2>

        <div className="columns is-centered">
          {/* Free Tier */}
          <div className="column is-4">
            <div className="box" style={boxStyle}>
              <h3 className="title is-4 has-text-centered has-text-dark">Free</h3>
              <p className="subtitle has-text-centered has-text-grey">免費版</p>
              <p className="title is-2 has-text-centered has-text-dark">$0</p>

              <div className="content has-text-dark">
                <ul>
                  <li>基本轉換功能</li>
                  <li>10MB 檔案大小限制</li>
                  <li>支援所有格式</li>
                </ul>
              </div>

              <button className="button is-fullwidth" disabled>
                目前方案
              </button>
            </div>
          </div>

          {/* Monthly Tier */}
          <div className="column is-4">
            <div className="box" style={boxStyle}>
              <h3 className="title is-4 has-text-centered has-text-dark">Monthly</h3>
              <p className="subtitle has-text-centered has-text-grey">月訂閱</p>
              <p className="title is-2 has-text-centered has-text-dark">
                NT$99<span className="is-size-6">/月</span>
              </p>

              <div className="content has-text-dark">
                <ul>
                  <li>Free 方案所有功能</li>
                  <li>100MB 檔案大小限制</li>
                  <li>自訂字典對照</li>
                  <li>優先處理佇列</li>
                </ul>
              </div>

              <button className="button is-fullwidth" disabled>
                即將推出
              </button>
            </div>
          </div>

          {/* Lifetime Tier */}
          <div className="column is-4">
            <div className="box" style={lifetimeBoxStyle}>
              <div className="has-text-centered mb-2">
                <span className="tag is-danger">限時優惠</span>
              </div>
              <h3 className="title is-4 has-text-centered has-text-dark">Lifetime</h3>
              <p className="subtitle has-text-centered has-text-grey">終身授權</p>
              <p className="title is-2 has-text-centered has-text-dark">
                <span className="has-text-grey" style={{ textDecoration: 'line-through' }}>
                  $899
                </span>
                {' '}
                <span className="has-text-primary">$499</span>
              </p>

              <div className="content has-text-dark">
                <ul>
                  <li>Monthly 方案所有功能</li>
                  <li>一次付費，永久使用</li>
                  <li>所有未來新功能</li>
                  <li>優先客戶支援</li>
                </ul>
              </div>

              <a
                href={gumroadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button is-primary is-fullwidth"
              >
                立即購買 →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
