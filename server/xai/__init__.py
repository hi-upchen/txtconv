from werkzeug.contrib.fixers import ProxyFix
from flask import Flask
from flask_sockets import Sockets
# from pymongo import MongoClient

app = Flask(__name__, static_url_path='/static', static_folder='static')
app.wsgi_app = ProxyFix(app.wsgi_app)
app.config.from_pyfile('../settings.py')
SETTINGS = app.config

sockets = Sockets(app)

import xai.txtconv.route
