"""Monta a versão do site para o GitHub Pages.

O GitHub Pages publica o site numa subpasta (https://<usuário>.github.io/<repo>/),
mas os arquivos em public/ apontam para a raiz ("/assets/...", "/products/...").
Este script copia public/ para a pasta de saída e coloca a subpasta na frente
desses endereços, sem mexer em public/ (que continua funcionando na raiz, por
exemplo no Cloudflare ou num domínio próprio).

Uso: python3 build_pages.py <pasta public> <pasta de saída> <subpasta, ex.: /DACION> [versão]
"""
import re
import shutil
import sys
from pathlib import Path

src, out, base = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3].rstrip("/")
version = sys.argv[4] if len(sys.argv) > 4 else ""

if out.exists():
    shutil.rmtree(out)
shutil.copytree(src, out)


def patch(path, pairs):
    text = path.read_text(encoding="utf-8")
    for old, new in pairs:
        if old not in text:
            sys.exit(f"{path.name}: trecho não encontrado: {old!r}")
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")


if base:
    # Página: arquivos de estilo, scripts e ícone; abertura só na página inicial.
    patch(out / "index.html", [
        ('href="/', f'href="{base}/'),
        ('src="/', f'src="{base}/'),
        ('location.pathname.replace(/\\/+$/,"")===""', f'location.pathname.replace(/\\/+$/,"")==="{base}"'),
    ])
    # App: fotos dos produtos e rotas (o roteador passa a usar a subpasta).
    bundle = next((out / "assets").glob("index-*.js"))
    patch(bundle, [
        ('"/products/', f'"{base}/products/'),
        ('parser:zv,base:""', f'parser:zv,base:"{base}"'),
    ])
    # Abertura animada: roda só na página inicial.
    patch(out / "intro.js", [('if (path !== "" ||', f'if (path !== "{base}" ||')])

# Versão nos endereços dos arquivos: o GitHub Pages pede ao navegador que
# guarde CSS e JS por 10 minutos; com "?v=<versão>" diferente a cada
# publicação, o navegador baixa os arquivos novos assim que a página atualiza.
if version:
    index = out / "index.html"
    html = index.read_text(encoding="utf-8")
    html, count = re.subn(r'((?:href|src)="[^"]+\.(?:css|js))(?:\?[^"]*)?"', rf'\1?v={version}"', html)
    if count < 4:
        sys.exit(f"index.html: esperava ao menos 4 arquivos CSS/JS, achei {count}")
    index.write_text(html, encoding="utf-8")
    patch(out / "dacion-theme.css", [('url("brand/dacion-hero.webp")', f'url("brand/dacion-hero.webp?v={version}")')])

# Links diretos (ex.: /produto/...) caem no 404.html, que abre o mesmo app.
shutil.copyfile(out / "index.html", out / "404.html")
# Publica os arquivos como estão, sem processamento do Jekyll.
(out / ".nojekyll").write_text("")
print(f"Site montado em {out} com a subpasta '{base or '/'}'")
