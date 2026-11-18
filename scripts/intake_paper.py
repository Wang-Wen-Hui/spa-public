"""Public PDF text/provenance intake entry. Figure reading remains an Agent task."""
import runpy
from pathlib import Path

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).resolve().parents[1] / 'engine' / 'intake.py'),
                   run_name='__main__')
