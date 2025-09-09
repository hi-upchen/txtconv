import React, { Component } from 'react';
import {observer} from "mobx-react";
import 'animate.css';
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

        {/* Original donation message - temporarily hidden
        {fileQueue.getQueueLength()>0 &&
          <div className="container animate__animated animate__pulse animate__delay-2s">
            <article className="message is-warning">
              <div className="message-header" style={{padding: "0.5rem 2rem"}}>
                <p>捐款支持這個小工具</p>
              </div>
              <div className="message-body" style={{padding: "0.5rem 2rem"}}>
                <p style={{"marginBottom":"0.25rem"}}>感謝您使用這簡轉繁小工具！如果您覺得它有幫助，請考慮捐款支持。您的捐款將幫助我繼續改進和維護這個小工具。</p>
                <div className="buttons" style={{"marginBottom":"0.25rem"}}>
                  <a href="https://upchen.gumroad.com/l/txtconv?utm_source=txtconv&utm_medium=website&utm_content=under-files" className="button is-primary is-light" target="_blank">捐款支持</a>
                </div>
              </div>
            </article>
          </div>
        }
        */}

        {/* Temporary survey message */}
        {fileQueue.getQueueLength()>0 &&
          <div className="container animate__animated animate__fadeInUp animate__delay-2s">
            <article className="message is-info survey-message">
              <div className="message-header" style={{padding: "0.5rem 2rem", background: "linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)"}}>
                <p>
                  <span style={{marginRight: "0.5rem", fontSize: "1.2rem"}}>📋</span>
                  幫助我們做得更好
                </p>
              </div>
              <div className="message-body" style={{padding: "1rem 2rem", background: "linear-gradient(to bottom, #fff5f5 0%, #ffffff 100%)"}}>
                <p style={{"marginBottom":"0.75rem", color: "#4a5568", lineHeight: "1.6"}}>
                  <span style={{fontWeight: "500"}}>感謝您使用繁簡轉換工具！</span>
                  <br/>
                  為了提供更好的服務，我們想了解您的使用需求。
                  <span style={{color: "#ee5a24", fontWeight: "500"}}> 只需 2 分鐘</span>，幫助我們改善功能！
                </p>
                <div className="buttons" style={{"marginBottom":"0.25rem"}}>
                  <a href="https://www.surveycake.com/s/w8oKr" 
                     className="button is-primary survey-button" 
                     target="_blank"
                     style={{
                       background: "linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)",
                       border: "none",
                       color: "white",
                       fontWeight: "500",
                       padding: "0.75rem 1.5rem",
                       transition: "all 0.3s ease",
                       boxShadow: "0 4px 6px rgba(238, 90, 36, 0.25)"
                     }}>
                    填寫問卷 →
                  </a>
                </div>
              </div>
            </article>
          </div>
        }
      </div>
    );
  }
}

export default observer(App);