import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('drive_transfer', ROOT / 'tools/drive_transfer.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class TransferTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.target = Path(self.temp.name) / 'drive/ava/player.exe'
        self.data = b'test installer content' * 100
        self.sha = hashlib.sha256(self.data).hexdigest()

    def copy(self, data=None, sha=None, size=None):
        return helper.transfer('https://example.com/installer.exe', self.target,
                               sha or self.sha, len(self.data) if size is None else size,
                               opener=lambda *_a, **_k: io.BytesIO(self.data if data is None else data), progress=lambda _: None)

    def test_copy_and_idempotent_rerun(self):
        self.assertTrue(self.copy())
        self.assertEqual(self.target.read_bytes(), self.data)
        self.assertFalse(helper.transfer('unused', self.target, self.sha, len(self.data),
                                        opener=lambda *_a, **_k: self.fail('existing copy must not download')))

    def test_wrong_hash_leaves_drive_untouched(self):
        with self.assertRaises(ValueError):
            self.copy(sha='0' * 64)
        self.assertFalse(self.target.parent.exists())

    def test_short_or_oversized_download_is_rejected(self):
        for data in [self.data[:-1], self.data + b'extra']:
            with self.subTest(size=len(data)), self.assertRaises(ValueError):
                self.copy(data=data)
            self.assertFalse(self.target.exists())

    def test_conflicting_existing_file_is_preserved(self):
        self.target.parent.mkdir(parents=True)
        self.target.write_bytes(b'important existing file')
        with self.assertRaises(FileExistsError):
            self.copy()
        self.assertEqual(self.target.read_bytes(), b'important existing file')

    def test_failed_drive_copy_removes_only_its_partial_file(self):
        def interrupted(incoming, output):
            output.write(b'partial')
            raise OSError('simulated Drive write failure')
        with patch.object(helper.shutil, 'copyfileobj', side_effect=interrupted):
            with self.assertRaises(OSError):
                self.copy()
        self.assertFalse(self.target.exists())

    def test_notebook_contains_exact_tested_code_and_no_fake_result(self):
        notebook = json.loads((ROOT / 'tools/copy-to-drive.ipynb').read_text())
        cell = notebook['cells'][1]
        code = ''.join(cell['source'])
        self.assertIn((ROOT / 'tools/drive_transfer.py').read_text(), code)
        self.assertIsNone(cell['execution_count'])
        self.assertEqual(cell['outputs'], [])
        compile(code, 'copy-to-drive.ipynb', 'exec')


if __name__ == '__main__':
    unittest.main()
