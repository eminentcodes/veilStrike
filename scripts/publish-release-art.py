from pathlib import Path
from PIL import Image, ImageEnhance
root = Path(__file__).resolve().parent.parent
source = root / 'verification/screenshots/release-art'
previews = root / 'apps/web/public/images/previews'
portraits = root / 'apps/web/public/images/fighters'
previews.mkdir(parents=True, exist_ok=True)
portraits.mkdir(parents=True, exist_ok=True)
for name in ['story', 'fighters', 'achievements', 'leaderboards']:
    image = Image.open(source / f'{name}.png').convert('RGB')
    image = ImageEnhance.Color(image).enhance(1.18)
    image = ImageEnhance.Contrast(image).enhance(1.08)
    image.save(previews / f'{name}.webp', quality=90)
for name in ['karen', 'taren', 'nomet', 'veyra', 'mawren']:
    Image.open(source / f'{name}.png').convert('RGB').save(portraits / f'{name}.webp', quality=90)
print('Published four distinct lobby preview images and five current model portraits.')
