import { extendObservable } from 'mobx'

class FileHandler {
	constructor(file) {
		extendObservable(this, {
			file: file,
			filename: file ? file.name : '',
			size: file ? file.size : '',
			uploadProgress: 0,
			convertProgress: 0,
			downloadLink: null,
			isUploading: false,
			isProcessing: false,
			errMessage: null
		})
	}

	/**
	 * Upload the file to server.
	 * We use AJAX to uplaod a file for these reasons:
	 *
	 * 1. Simple websocket cannot get the progress
	 * 2. It's more easy.
	 *
	 *
	 * @return {}
	 */
	upload() {
		// prepare form data
		var formData = new FormData();
		formData.append('file', this.file);
		this.isProcessing = true;

		// create the ajax
		var xhr = new XMLHttpRequest();
		xhr.open('POST', window.CONFS.apiServer + '/api/conv');

		xhr.upload.onprogress = (event) => {
			this.isUploading = true;
			if (event.lengthComputable) {
				let complete = (event.loaded / event.total * 100 | 0);
				this.uploadProgress = complete;
			}
		}

		xhr.upload.onloadend = (event) => {
			this.isUploading = false;
		}

		xhr.onload = () => {
			this.uploadProgress = 100;
			this.isProcessing = false;
			this.isUploading = false;

			if (xhr.status === 200) {
				this.notifyServerShouldConvert()
			} else {
				this.errMessage = 'Something wrong';
			}
		};

		xhr.onerror = (e) => {
			this.isProcessing = false;
			this.isUploading = false;

			switch (xhr.status) {
				case 404:
					this.errMessage = '404 File not found';
					break;
				case 500:
					this.errMessage = '500 Server error';
					break;
				case 0:
					this.errMessage = '500 Request aborted';
					break;
				default:
					this.errMessage = 'Unknown error ' + xhr.status;
			}
		};

		xhr.send(formData);
	}

	/**
	 * Connect to the websocket.
	 * @return {Promise}
	 */
	ensureWebSocket() {
		return new Promise((resolve, reject) => {
			let ws = this.websocket

			if (ws && ws.readyState === ws.OPEN) {
				resolve()
			} else if (ws && ws.readyState === ws.CONNECTING) {
				// wait a while
				// do nothing, wait for onopen callback
			} else {
				console.log("Create a new socket")
				// create the websocket
				ws = this.websocket = new WebSocket(window.CONFS.wsServer + "/opencc")
				ws.binaryType = "arraybuffer"

				ws.onopen = (evt) => { console.log("ws open", evt); resolve() }
				ws.onclose = (evt) => { this.onWsClose(evt) }
				ws.onmessage = (evt) => { this.onWsMessage(evt) }
				ws.onerror = (evt) => { this.onWsError(evt) }
			}
		})
	}

	/**
	 * When the ajax already uploads the file,
	 * we tell server side to start converting by websocket protocol.
	 *
	 * @return {Promise}
	 */
	notifyServerShouldConvert() {
		var file = this.file

		return this.ensureWebSocket()
			.then(() => {
				// tell the server the file alreadt transferred
				this.websocket.send(JSON.stringify({
					action: "DO_CONVERT_FILE",
					name: file.name
				}))
				this.isProcessing = true
			})
	}

	onWsOpen(evt) {
		console.log('onWsOpen', evt)
	}
	onWsClose(evt) {
		console.log('onWsClose', evt)
	}
	onWsMessage(evt) {
		console.log('onWsMessage', evt)

		let evtdata = JSON.parse(evt.data)

		if (evtdata.action === "START_CONVERTING") {
			this.isProcessing = true
		}
		else if (evtdata.action === "FINISHED_CONVERT") {
			// find out that file
			this.isProcessing = false
			this.downloadLink = window.CONFS.apiServer + evtdata.downloadLink.replace('/v1.0', '')
		} else if (evtdata.action === "CONVERT_PROGRESS") {
			this.convertProgress = evtdata.percent
		}

		return false
	}
	onWsError(evt) {
		console.log('onWsError', evt)
		this.errMessage = "" + evt
	}
}

class FileQueue {
	constructor() {
		extendObservable(this, {
			queue: []
		})
	}

	addFile(file) {
		let handler = new FileHandler(file);
		handler.upload()
		this.queue.push(handler)
	}

	/**
	 * Returns the length of the queue.
	 *
	 * @returns {number} The length of the queue.
	 */
	getQueueLength() {
		return this.queue.length;
	}
}

export { FileQueue, FileHandler }
