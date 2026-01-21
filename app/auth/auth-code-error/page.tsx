import Link from 'next/link';

export const metadata = {
  title: '登入連結已失效',
};

export default function AuthCodeErrorPage() {
  return (
    <div className="App">
      <section className="hero is-fullheight">
        <div className="hero-body">
          <div className="container">
            <div className="columns is-centered">
              <div className="column is-half has-text-centered">
                <h1 className="title has-text-dark">
                  登入連結已失效
                </h1>
                <p className="subtitle has-text-grey mt-4">
                  此連結可能已過期或已被使用。
                </p>
                <p className="has-text-grey mb-5">
                  請返回首頁重新發送登入連結。
                </p>
                <Link href="/" className="button is-primary is-medium">
                  返回首頁
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
