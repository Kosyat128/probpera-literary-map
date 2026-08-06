#
texts = ["\u0420\u0401\u0421","\u041f\u043e\u043f\u043e\u043b\u043d\u044f\u0435\u043c", "\u0422\u043e\u043b\u044c\u043a\u043e"]
for t in texts:
    print('input', t)
    try:
        raw = bytes([ord(ch).encode('cp1251')[0] for ch in t])
        try:
            fixed = raw.decode('utf-8')
            print('fixed', fixed)
        except Exception as e:
            print('decode_err', type(e).__name__)
    except Exception as e:
        print('enc_err', type(e).__name__)
