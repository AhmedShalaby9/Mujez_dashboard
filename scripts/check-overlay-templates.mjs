import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseTemplate } from '@angular/compiler';

function files(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)],
  );
}
function children(node) {
  return [
    ...(node.children ?? []),
    ...(node.branches ?? []),
    ...(node.cases ?? []),
    ...(node.empty ? [node.empty] : []),
  ];
}
function attribute(node, name) {
  return node.attributes?.find((a) => a.name === name)?.value;
}
function hasName(node, name) {
  return (
    !!attribute(node, name) ||
    node.inputs?.some((input) => input.name === name || input.name === 'attr.' + name)
  );
}
let overlays = 0;
let closeButtons = 0;
for (const file of files('src/app/pages').filter((path) => path.endsWith('.html'))) {
  const template = parseTemplate(readFileSync(file, 'utf8'), file);
  assert.equal(template.errors, null, file + ': template must parse');
  function visit(node) {
    const classes = attribute(node, 'class') ?? '';
    if (/(?:^|\s)(dialog|drawer)(?:\s|$)/.test(classes)) {
      overlays++;
      assert.equal(attribute(node, 'role'), 'dialog', file + ': overlay needs a dialog role');
      assert.equal(attribute(node, 'aria-modal'), 'true', file + ': overlay needs modal semantics');
      assert.ok(
        hasName(node, 'aria-label') || hasName(node, 'aria-labelledby'),
        file + ': overlay needs an accessible name',
      );
      const forms = new Set();
      const associatedButtons = [];
      function associations(child) {
        if (child.name === 'form' && attribute(child, 'id')) forms.add(attribute(child, 'id'));
        if (child.name === 'button' && attribute(child, 'form')) associatedButtons.push(child);
        children(child).forEach(associations);
      }
      children(node).forEach(associations);
      for (const button of associatedButtons) {
        assert.ok(
          forms.has(attribute(button, 'form')),
          file + ': footer submit button must target its form',
        );
        assert.equal(
          attribute(button, 'type'),
          'submit',
          file + ': associated footer action must submit',
        );
      }
      const label = attribute(node, 'aria-labelledby');
      if (label) {
        const ids = new Set();
        function collect(child) {
          if (attribute(child, 'id')) ids.add(attribute(child, 'id'));
          children(child).forEach(collect);
        }
        children(node).forEach(collect);
        for (const id of label.split(/\s+/))
          assert.ok(ids.has(id), file + ': missing overlay title ' + id);
      }
    }
    if (node.name === 'button' && /(?:^|\s)x(?:\s|$)/.test(classes)) {
      closeButtons++;
      assert.ok(
        hasName(node, 'aria-label') || hasName(node, 'aria-labelledby'),
        file + ': icon close button needs a name',
      );
    }
    children(node).forEach(visit);
  }
  template.nodes.forEach(visit);
}
assert.ok(overlays > 0, 'Expected to discover application overlays');
console.log(
  `Checked ${overlays} overlays and ${closeButtons} icon close buttons across all workspace templates.`,
);
