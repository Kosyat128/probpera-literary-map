# -*- coding: utf-8 -*-
import json

p='src/data/countries/generated/books.generated.json'
obj=json.loads(open(p,encoding='utf-8').read())

def walk(o,path=''):
    if isinstance(o,str):
        if '\u00c2' in o:
            print(path, o)
    elif isinstance(o,dict):
        for k,v in o.items():
            walk(v, f'{path}.{k}' if path else k)
    elif isinstance(o,list):
        for i,v in enumerate(o):
            walk(v, f'{path}[{i}]')

walk(obj)
