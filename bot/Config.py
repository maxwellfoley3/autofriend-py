import json
import os
f = open(os.path.abspath('./accounts-config.json'), 'r')
config = json.load(f)
