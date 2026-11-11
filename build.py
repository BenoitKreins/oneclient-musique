#!/usr/bin/env python3
"""Construit l'outil musique : src/ -> dist/page.html, puis la version à publier.

  python3 build.py            -> dist/page.html
  python3 build.py --release  -> dist/musique-vX.Y-AAAA-MM-JJ/ (fichiers nommés application-fichier-version-date, plus le .zip)
"""
import os, re, shutil, sys, zipfile
R = os.path.dirname(os.path.abspath(__file__)); S = os.path.join(R, 'src'); D = os.path.join(R, 'dist')
read = lambda p: open(p, encoding='utf8').read()
ver, date = read(os.path.join(S, 'VERSION')).split()
tag = f'Outil musique OneClient {ver} du {date}'

t = read(os.path.join(S, 'template.html'))
for marker, name in [('/*FONTS*/', 'fonts.css'), ('/*ENGINE*/', 'engine.js'), ('/*UNZIP*/', 'unzip.js'), ('/*UI*/', 'ui.js')]:
    t = t.replace(marker, read(os.path.join(S, name)))
t = f'<meta name="version" content="{tag}">\n' + t
i = t.index('</style>')
page = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + t[:i] + '\n/* Standalone page reset */\nhtml { -webkit-text-size-adjust: 100%; }\nbody { margin: 0; }\nimg { max-width: 100%; }\n[hidden] { display: none !important; }\n:root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }\n</style>\n</head>\n<body>\n'
        + t[i + len('</style>'):].lstrip('\n') + '\n</body>\n</html>\n')
os.makedirs(D, exist_ok=True)
open(os.path.join(D, 'page.html'), 'w', encoding='utf8').write(page)
print('dist/page.html', len(page), 'octets,', tag)

if '--release' in sys.argv:
    out = os.path.join(D, f'musique-{ver}-{date}'); os.makedirs(out, exist_ok=True)
    php = {}
    for name in ['index.php', 'stats.php']:
        s = re.sub(r'^<\?php\n(// Outil musique OneClient .*\n)?', f'<?php\n// {tag}\n', read(os.path.join(R, 'php', name)), count=1)
        php[name] = s
    files = {'page.html': page, **php}
    for name, content in files.items():
        base, ext = os.path.splitext(name)
        open(os.path.join(out, f'musique-{base}-{ver}-{date}{ext}'), 'w', encoding='utf8').write(content)
    with zipfile.ZipFile(os.path.join(out, f'musique-{ver}-{date}.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items(): z.writestr(f'outils/musique/{name}', content)
    print(out); print('\n'.join(sorted(os.listdir(out))))
