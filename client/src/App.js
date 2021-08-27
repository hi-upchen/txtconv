import React, { Component } from 'react';
import './App.css';

import Uploader from './uploader'
import FileQueue from './filequeue'

class App extends Component {
  render() {
    const {fileQueue} = this.props;

    return (
      <div className="App">
        <section className="hero">
          <div className="hero-body">
            <div className="container">
              <h1 className="title has-text-left">
                小說字幕簡轉繁、純文字檔案簡體轉繁體
              </h1>
              <h2 className="subtitle has-text-left">
                線上免費將電影字幕、小說、電子書、CSV 等文字檔從簡體轉換成繁體中文，支援批次轉換。
              </h2>
              <p>
                支援檔案格式為：
                <ul>
                  <li>.txt 純文字小說檔案</li>
                  <li>.srt 電影字幕檔案</li>
                  <li>.csv 資料格式</li>
                </ul>
              </p>
            </div>
          </div>
        </section>

        <div className="container">
          <div className="dropzone-panel">
            <Uploader fileQueue={fileQueue}></Uploader>
          </div>
          <FileQueue fileQueue={fileQueue}></FileQueue>
        </div>
      </div>
    );
  }
}

export default App;
