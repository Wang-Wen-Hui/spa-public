"""Read a local PPTX/PDF corpus without changing sources; keep slide/page provenance."""
import argparse
import hashlib
import json
import posixpath
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from pypdf import PdfReader

NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}

def relationships(z, part):
    rel = posixpath.join(posixpath.dirname(part), '_rels', posixpath.basename(part)+'.rels')
    if rel not in z.namelist():
        return {}
    return {x.attrib['Id']: {'type': x.attrib['Type'].split('/')[-1],
                            'target': x.attrib['Target'] if x.attrib.get('TargetMode') == 'External'
                            else posixpath.normpath(posixpath.join(posixpath.dirname(part), x.attrib['Target'])).lstrip('/')}
            for x in ET.fromstring(z.read(rel))}

def paragraphs(node):
    if node is None:
        return ''
    return '\n'.join(
        ''.join(t.text or '' for t in p.findall('.//a:t', NS)) for p in node.findall('.//a:p', NS))

def read_deck(file):
    slides = []
    with zipfile.ZipFile(file) as z:
        root = ET.fromstring(z.read('ppt/presentation.xml'))
        rels = relationships(z, 'ppt/presentation.xml')
        for num, ref in enumerate(root.findall('p:sldIdLst/p:sldId', NS), 1):
            part = rels[ref.attrib['{'+NS['r']+'}id']]['target']
            slide = ET.fromstring(z.read(part))
            sr = relationships(z, part)
            shapes = []
            for shape in slide.findall('.//p:sp', NS):
                value = paragraphs(shape)
                if value.strip():
                    name = shape.find('p:nvSpPr/p:cNvPr', NS)
                    shapes.append({'name': name.attrib.get('name', '') if name is not None else '', 'text': value})
            notes = []
            for r in sr.values():
                if r['type'] != 'notesSlide':
                    continue
                nr = ET.fromstring(z.read(r['target']))
                for shape in nr.findall('.//p:sp', NS):
                    ph = shape.find('p:nvSpPr/p:nvPr/p:ph', NS)
                    if ph is not None and ph.attrib.get('type') in ('sldNum', 'hdr', 'ftr', 'dt', 'sldImg'):
                        continue
                    value = paragraphs(shape).strip()
                    if value:
                        notes.append(value)
            slides.append({'slide': num, 'hidden': slide.attrib.get('show') == '0', 'text': '\n'.join(x['text'] for x in shapes),
                           'shapes': shapes, 'notes': '\n'.join(notes),
                           'pictures': len(slide.findall('.//p:pic', NS)),
                           'hyperlinks': [x['target'] for x in sr.values() if x['type'] == 'hyperlink']})
        size = root.find('p:sldSz', NS)
    return {'slides': slides, 'size_emu': dict(size.attrib)}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('root', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = {'decks': [], 'pdfs': []}
    for file in sorted(args.root.rglob('*')):
        if file.suffix.lower() not in ('.pptx', '.pdf') or file.name.startswith('~$'):
            continue
        entry = {'path': str(file.resolve()), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
        stem = f"{file.stem}-{entry['sha256'][:8]}"
        if file.suffix.lower() == '.pptx':
            entry.update(read_deck(file))
            entry['extraction'] = stem+'.md'
            content = [f"# {file.name}\n\nSource: {file.resolve()}\n"]
            for s in entry['slides']:
                content.append(f"## Slide {s['slide']} | images {s['pictures']} | hidden {s['hidden']}\n\n{s['text']}\n\n### Speaker notes\n\n{s['notes'] or '[EMPTY]'}\n")
            (args.out / entry['extraction']).write_text('\n'.join(content), encoding='utf-8')
            manifest['decks'].append(entry)
            print(file.name, 'slides', len(entry['slides']), 'notes', sum(bool(s['notes']) for s in entry['slides']))
        else:
            try:
                pdf = PdfReader(file)
                entry['pages'] = len(pdf.pages)
                entry['extraction'] = stem+'.txt'
                text = '\n\n'.join(f"PAGE {i}\n{p.extract_text() or ''}" for i, p in enumerate(pdf.pages, 1))
                entry['opening'] = text[:1600]
                (args.out / entry['extraction']).write_text(text, encoding='utf-8')
            except Exception as e:
                entry['error'] = str(e)
            manifest['pdfs'].append(entry)
    (args.out/'corpus.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print('PDF files', len(manifest['pdfs']))

if __name__ == '__main__':
    main()
