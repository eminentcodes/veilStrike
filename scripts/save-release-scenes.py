"""Import the finished game meshes and save editable Blender scenes without re-exporting animation."""
import bpy
import json
from pathlib import Path

workspace = Path(__file__).resolve().parent.parent
assets = workspace / 'apps/web/public/models/characters'
manifest = json.loads((assets / 'manifest.json').read_text(encoding='utf-8'))
for fighter in ['karen', 'nomet', 'veyra', 'mawren']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    entry = manifest['characters'][fighter]
    bpy.ops.import_scene.gltf(filepath=str(assets / entry['file']))
    bpy.context.scene['fighter'] = fighter
    bpy.context.scene['game_asset'] = entry['file']
    bpy.context.scene['runtime_choreography'] = 'apps/web/src/duel/stances.ts'
    bpy.context.scene['equipment_authoring'] = entry.get('refinementScript', '')
    bpy.context.scene['art_reference'] = 'C:/Users/Great/Downloads/SAMPLECHARA.jpg'
    name = f'{fighter}-release-v1.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(workspace / 'assets/characters' / name))
    entry['source'] = name
    print('EDITABLE SCENE:', name, flush=True)
(assets / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
