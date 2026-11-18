"""Extract source text with page provenance; never treat text extraction as figure reading."""
import argparse, hashlib, json
from pathlib import Path
from pypdf import PdfReader

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf', nargs='+', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = []
    for i, file in enumerate(args.pdf, 1):
        reader = PdfReader(file)
        stem = f'source-{i}'
        pages = [{'page': n, 'text': p.extract_text() or '', 'visual_status': 'unverified'} for n, p in enumerate(reader.pages, 1)]
        (args.out / f'{stem}.json').write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding='utf-8')
        manifest.append({'id': stem, 'path': str(file.resolve()), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'pages': len(pages), 'text_file': f'{stem}.json', 'possibly_scanned_pages': [p['page'] for p in pages if len(p['text'].strip()) < 30]})
    (args.out / 'sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'sources': len(manifest), 'output': str(args.out.resolve()), 'visual_review': 'required; render relevant pages with pdftoppm'}, ensure_ascii=False))

if __name__ == '__main__':
    main()
