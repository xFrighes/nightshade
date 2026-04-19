import sys

path = '/home/frighes/Projects/gamemame/src/game/GameScene.ts'
with open(path, 'r') as f:
    lines = f.readlines()

# Find the spot
new_lines = []
found = False
for i, line in enumerate(lines):
    if 'this.platforms.add(plat);' in line and not found:
        new_lines.append(line)
        new_lines.append('  }\n')
        new_lines.append('\n')
        new_lines.append('  private syncPlayerBodyToFrame() {\n')
        new_lines.append('    if (!this.player?.body || !this.player.frame) return;\n')
        new_lines.append('\n')
        new_lines.append('    const body = this.player.body as Phaser.Physics.Arcade.Body;\n')
        new_lines.append('    const bodyWidth = this.v(126);\n')
        new_lines.append('    const bodyHeight = this.v(316);\n')
        new_lines.append('    const frameWidth = this.player.frame.realWidth;\n')
        new_lines.append('    const frameHeight = this.player.frame.realHeight;\n')
        new_lines.append('\n')
        new_lines.append('    body.setSize(bodyWidth / this.player.scaleX, bodyHeight / this.player.scaleY);\n')
        new_lines.append('    body.setOffset((frameWidth - (bodyWidth / this.player.scaleX)) / 2, frameHeight - (bodyHeight / this.player.scaleY));\n')
        new_lines.append('  }\n')
        new_lines.append('\n')
        new_lines.append('  private addInteractable(\n')
        found = True
    elif 'id: string, name: string, hint: string,' in line and found:
        # We already added the header, so just keep this line
        new_lines.append(line)
    elif 'id: string, name: string, hint: string,' in line and not found:
        # This is the case where we lost the platforms.add or it's further up
        # But we know it's missing the header
        new_lines.append('  private addInteractable(\n')
        new_lines.append(line)
    else:
        new_lines.append(line)

with open(path, 'w') as f:
    f.writelines(new_lines)
print('Fixed')
