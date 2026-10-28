"""Copy the published AVA installer to a mounted Drive, verifying its checksum.

This module never executes the installer and never handles Google credentials.
Google Colab mounts Drive through Google's own authorization screen.
"""
import hashlib
import shutil
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen

VERSION = '0.2.0'
ASSET = f'AVA-Player-Setup-{VERSION}-x64.exe'
URL = f'https://github.com/hassandana1371-hub/ava-player/releases/download/v{VERSION}/{ASSET}'
SHA256 = '83e4275c069ae8d0b6d503dc1223fad9fde7c940720ed91ed654d4d03780aa4b'
SIZE = 194813807


def digest(file):
    with Path(file).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def transfer(url, destination, expected_hash, expected_size, *, opener=urlopen, progress=print):
    """Return True for a new verified copy, False for an identical existing file.

    Conflicting existing files are preserved. A download must pass both length
    and SHA256 checks before anything is written to the destination directory.
    """
    destination = Path(destination)
    if destination.exists():
        if destination.is_file() and destination.stat().st_size == expected_size and digest(destination) == expected_hash:
            return False
        raise FileExistsError('یک فایل متفاوت با همین نام وجود دارد؛ مسیر دیگری انتخاب کنید.')
    with tempfile.TemporaryDirectory(prefix='ava-drive-') as directory:
        downloaded = Path(directory) / 'installer.download'
        hasher = hashlib.sha256()
        received = 0
        last_report = 0
        request = Request(url, headers={'User-Agent': 'AVA-Player-Drive-Transfer/0.2'})
        with opener(request, timeout=60) as response, downloaded.open('wb') as output:
            while block := response.read(1024 * 1024):
                received += len(block)
                if received > expected_size:
                    raise ValueError('حجم فایل دریافت‌شده با نسخهٔ تأییدشده مطابقت ندارد.')
                output.write(block)
                hasher.update(block)
                if received - last_report >= 32 * 1024 * 1024:
                    progress(f'دریافت: {received // (1024 * 1024)} مگابایت')
                    last_report = received
        if received != expected_size or hasher.hexdigest() != expected_hash:
            raise ValueError('بررسی صحت فایل موفق نبود؛ فایل به درایو منتقل نشد.')
        destination.parent.mkdir(parents=True, exist_ok=True)
        created = False
        try:
            # Exclusive creation also protects against a concurrent upload.
            with destination.open('xb') as output, downloaded.open('rb') as incoming:
                created = True
                shutil.copyfileobj(incoming, output)
            if digest(destination) != expected_hash:
                raise ValueError('بررسی فایل کپی‌شده در درایو موفق نبود.')
        except BaseException:
            if created:
                destination.unlink(missing_ok=True)
            raise
    return True
