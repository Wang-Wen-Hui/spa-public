"""Public read-only PPTX inspection entry; preserves the existing inspector CLI."""
import runpy
from pathlib import Path

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).resolve().parents[1] / 'engine' / 'inspect_pptx.py'),
                   run_name='__main__')
