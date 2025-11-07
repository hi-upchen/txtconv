import FileUpload from '@/components/FileUpload';

export default function Home() {
  return (
    <div className="App">
      <section className="hero">
        <div className="hero-body">
          <div className="container">
            <h1 className="title has-text-left has-text-dark">
              小說字幕簡轉繁、純文字檔案簡體轉繁體
            </h1>
            <h2 className="subtitle has-text-left has-text-dark mt-2">
              線上免費將剪映 Capbut 字幕、小說、電子書、CSV 等文字檔從簡體轉換成繁體中文，支援批次轉換。
            </h2>
            <div className="has-text-dark">
              <p>支援檔案格式為：</p>
              <ul>
                <li>.txt 純文字小說檔案</li>
                <li>.srt 電影字幕檔案</li>
                <li>.csv 資料格式</li>
                <li>.xml 資料格式</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="dropzone-panel">
          <FileUpload />
        </div>
      </div>
    </div>
  );
}
