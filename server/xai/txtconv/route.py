from flask import Flask, jsonify, request, Response, send_from_directory, url_for, make_response, send_file
from xai import app, sockets
import json
import requests
import time
import os
import datetime
import logging
import chardet
from urllib.parse import quote
from opencc import OpenCC

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# endpoints
@app.route("/", methods=['GET'])
def indexAction():
	return jsonify({
		'Hi': 'Server side works fine'
	})

""" Helpers function to generate the file name"""
def genSrcFileName(srcName):
	return datetime.datetime.now().strftime("%Y-%m-%d SRC")+srcName
def genDestFilename(srcName):
	openCC = OpenCC('s2twp')
	return datetime.datetime.now().strftime("%Y-%m-%d ")+openCC.convert(srcName)
def genSrcFilePath(srcName):
	return os.path.join(app.config['UPLOAD_FOLDER'], genSrcFileName(srcName))
def genDestFilePath(srcName):
	return os.path.join(app.config['UPLOAD_FOLDER'], genDestFilename(srcName))

@app.route("/"+app.config['API_VERSION']+"/api/conv", methods=['POST'])
def conv():
	if request.method == 'POST':
		# check if the post request has the file part
		if 'file' not in request.files:
			return jsonify({
				'status': 'Error',
				'message': 'Shold have file part'
			})

		file = request.files['file']

		if file.filename == '':
			return jsonify({
				'status': 'Error',
				'message': 'No file is selected'
			})

		if file:
			# prepare the files
			srcFileName = genSrcFileName(file.filename)
			srcFilePath = genSrcFilePath(file.filename)
			file.save(srcFilePath)

			return jsonify({
				'status': 'OK'
			})

@app.route("/"+app.config['API_VERSION']+"/static_file/<path:filename>", methods=['GET'])
def static_file(filename):
	""" Serve the static file from upload folder"""
	path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
	response = make_response(send_file(path))
	basename = os.path.basename(path)
	response.headers["Content-Disposition"] = \
			"attachment;" \
			"filename*=UTF-8''{utf_filename}".format(
					utf_filename=quote(basename.encode('utf-8'))
			)

	return response

@sockets.route("/"+app.config['API_VERSION']+'/echo')
def hello_socket(ws):
	""" Websocket test API"""
	while not ws.closed:
		message = ws.receive()
		ws.send('hello:'+message)

def convertFile(srcPath, destPath, progressCallback=None):
	""" Convert the given file into traditional chinese and save to destPath"""
	openCC = OpenCC('s2twp')

	# guess the encoding
	rawdata = open(srcPath, 'rb').read(500)
	result = chardet.detect(rawdata)
	charenc = result['encoding']

	# count the total lines
	totalLines = 0
	with open(srcPath, 'r', encoding=charenc, errors='ignore') as srcf:
		for i, l in enumerate(srcf):
				pass
		totalLines = i+1

	# convert the file content
	prevProgress = 0
	with open(srcPath, 'r', encoding=charenc, errors='ignore') as srcf:
		with open(destPath, 'w') as destf:
			for j, line in enumerate(srcf):
				line = openCC.convert(line)
				destf.write(line)

				# tell outside the converting progress
				if progressCallback:
					currProgress = j/totalLines
					if currProgress-prevProgress>=0.01:
						progressCallback(currProgress)
						prevProgress = currProgress

@sockets.route("/"+app.config['API_VERSION']+'/opencc')
def opencc(ws):
	openCC = OpenCC('s2twp')
	ymd = datetime.datetime.now().strftime("%Y-%m-%d %H%M%S")

	srcFilePath = app.config['UPLOAD_FOLDER']+'/'+ymd+' SRC _FILENAME_'
	destFilePath = app.config['UPLOAD_FOLDER']+'/'+ymd+' _FILENAME_'

	while not ws.closed:
		message = ws.receive()

		if isinstance(message, str):
			try: # is a json file
				message = json.loads(message)
				print("Websocket receive json", message)

				if message['action']=="DO_CONVERT_FILE":
					srcName = message["name"]

					ws.send(json.dumps({
						"action": "START_CONVERTING"
					}))

					# start to convert this file
					destPath = genDestFilePath(srcName)

					convertFile(
						genSrcFilePath(srcName), destPath,
						progressCallback=lambda percent:
							ws.send(json.dumps({
								"action": "CONVERT_PROGRESS",
								"percent": percent
							})))

					# tell the client its finished
					ws.send(json.dumps({
						"action": "FINISHED_CONVERT",
						"file": message['name'],
						"downloadLink": url_for('static_file', filename=os.path.basename(destPath))
					}))

					# no longer keep it alive when this file is finished
					ws.close()

			except Exception as e: # is not a valid json
				print("Websocket error when converting the json string into object")

				ws.send(json.dumps({
					"action": "ERROR",
					"message": ""+e
				}))

				raise e
		else:
			raise "Un-supported websocket message"


