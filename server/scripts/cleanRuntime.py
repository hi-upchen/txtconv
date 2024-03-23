if __name__ == '__main__':
    if __package__ is None:
        import sys
        from os import path
        rootPath = path.abspath(path.join(path.dirname(path.abspath(__file__)), '../'))
        sys.path.append(rootPath)

import os
import datetime
import time
from os.path import isfile, join
from xai import app

RUNTIME_PATH = app.config['UPLOAD_FOLDER']

now = time.time()
for filename in os.listdir(RUNTIME_PATH):
	path = join(RUNTIME_PATH, filename)

	if filename==".gitignore":
		continue

	if isfile(path):
		mtimestamp = os.path.getmtime(path)
		sec2now = now-mtimestamp

		if sec2now>86400*1: # more than 7 days
			print("DELETE %s %s" % (datetime.datetime.fromtimestamp(mtimestamp), filename))
			os.remove(path)

