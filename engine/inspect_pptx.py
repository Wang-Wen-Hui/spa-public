"""Read-only OOXML checks after manual image insertion. Findings need visual review."""
import argparse, io, json, posixpath, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image

NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main', 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}

def inspect(file):
    findings = []
    with zipfile.ZipFile(file) as z:
        root = ET.fromstring(z.read('ppt/presentation.xml'))
        size = root.find('p:sldSz', NS)
        width, height = int(size.attrib['cx']), int(size.attrib['cy'])
        slides = sorted((n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')), key=lambda n: int(Path(n).stem[5:]))
        for page, name in enumerate(slides, 1):
            tree = ET.fromstring(z.read(name))
            relpath = posixpath.join(posixpath.dirname(name), '_rels', posixpath.basename(name) + '.rels')
            rels = {r.attrib['Id']: posixpath.normpath(posixpath.join(posixpath.dirname(name), r.attrib['Target'])) for r in ET.fromstring(z.read(relpath)) if r.attrib.get('TargetMode') != 'External'} if relpath in z.namelist() else {}
            def report(code, detail): findings.append({'slide': page, 'code': code, 'detail': detail})
            if not any('notesSlide' in t for t in rels.values()): report('missing_notes', 'No speaker notes relationship')
            for obj in tree.findall('.//p:sp', NS) + tree.findall('.//p:pic', NS):
                xf = obj.find('p:spPr/a:xfrm', NS)
                if xf is None: continue
                off, ext = xf.find('a:off', NS), xf.find('a:ext', NS)
                if off is None or ext is None: continue
                x, y, w, h = int(off.attrib['x']), int(off.attrib['y']), int(ext.attrib['cx']), int(ext.attrib['cy'])
                if min(x, y) < 0 or x+w > width+100 or y+h > height+100: report('out_of_bounds', ET.tostring(obj, encoding='unicode')[:120])
                blip = obj.find('.//a:blip', NS)
                if blip is not None:
                    target = rels.get(blip.attrib.get('{'+NS['r']+'}embed'))
                    crop = obj.find('.//a:srcRect', NS)
                    if crop is not None and any(int(v) for v in crop.attrib.values()): report('image_crop', 'Evidence image has cropping; verify axes, legend and scale bar')
                    if target in z.namelist():
                        try:
                            im = Image.open(io.BytesIO(z.read(target)))
                            if h and (crop is None or not any(int(v) for v in crop.attrib.values())) and abs((w/h)/(im.width/im.height)-1) > 0.03: report('image_aspect', f'{target}: displayed aspect differs by more than 3%')
                        except Exception: report('image_format_unchecked', str(target))
            if tree.find('.//p:grpSp', NS) is not None: report('group_geometry_unchecked', 'Grouped transforms need visual inspection')
    return {'slides': len(slides), 'findings': findings, 'limitations': 'Read-only OOXML checks; no scientific verification or pixel-level text-overflow detection. Inspect rendered slides too.'}

if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('pptx', type=Path); p.add_argument('--out', type=Path); a=p.parse_args()
    result=inspect(a.pptx); text=json.dumps(result,ensure_ascii=False,indent=2)
    if a.out: a.out.write_text(text,encoding='utf-8')
    print(text)
