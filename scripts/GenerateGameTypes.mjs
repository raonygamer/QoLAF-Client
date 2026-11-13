import ts from 'typescript';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const requestedInput = process.argv[2];
if (!requestedInput) throw new Error('Usage: npm run types:game -- /path/to/astroflux.js');
const input = resolve(requestedInput);
const source = await readFile(input, 'utf8');
// Reviewed against the current wrapper implementations and source signatures.
// Keep this separate from generated declarations so regeneration preserves it.
const signatures = JSON.parse(
  await readFile(new URL('./types/Signatures.json', import.meta.url), 'utf8'),
);
const tree = ts.createSourceFile(input, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
if (tree.parseDiagnostics.length)
  throw new Error('Cannot generate declarations from invalid JavaScript');
// Bind identifiers to their actual lexical declarations. Minified local names
// are reused heavily; a flat string-keyed map silently mixes unrelated scopes.
const compilerOptions = { allowJs: true, noLib: true, noResolve: true };
const compilerHost = ts.createCompilerHost(compilerOptions);
compilerHost.getSourceFile = (fileName) => (fileName === input ? tree : undefined);
const checker = ts.createProgram([input], compilerOptions, compilerHost).getTypeChecker();
function binding(identifier) {
  // Native Math/String/Array/Date have Haxe metadata but no local declaration.
  return checker.getSymbolAtLocation(identifier) ?? `global:${identifier.text}`;
}
function constructorFor(identifier) {
  const declaration = checker.getSymbolAtLocation(identifier)?.valueDeclaration;
  return declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
}
const assignments = [];
const mutations = [];
function visit(node) {
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    mutations.push({
      target: node.left,
      value: node.operatorToken.kind === ts.SyntaxKind.EqualsToken ? node.right : null,
    });
  } else if (
    (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
    (node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken)
  ) {
    mutations.push({ target: node.operand, value: null });
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken)
    assignments.push(node);
  ts.forEachChild(node, visit);
}
visit(tree);
const classes = new Map();
for (const { left, right } of assignments) {
  if (
    ts.isPropertyAccessExpression(left) &&
    ts.isIdentifier(left.expression) &&
    left.name.text === '__name__' &&
    ts.isStringLiteral(right)
  ) {
    classes.set(binding(left.expression), {
      name: right.text,
      instance: new Map(),
      statics: new Map(),
      staticWrites: new Map(),
      dynamicStaticWrite: false,
      parent: null,
      constructor: constructorFor(left.expression),
    });
  }
}
function properties(node, into) {
  if (!ts.isObjectLiteralExpression(node)) return;
  for (const entry of node.properties) {
    if (!ts.isPropertyAssignment(entry)) continue;
    const name =
      ts.isIdentifier(entry.name) || ts.isStringLiteral(entry.name) ? entry.name.text : null;
    if (name && !name.startsWith('__')) into.set(name, entry.initializer);
  }
}
for (const { left, right } of assignments) {
  if (!ts.isPropertyAccessExpression(left) || !ts.isIdentifier(left.expression)) continue;
  const cls = classes.get(binding(left.expression));
  if (!cls) continue;
  const key = left.name.text;
  if (key === '__super__' && ts.isIdentifier(right)) cls.parent = binding(right);
  else if (key === 'prototype') {
    properties(right, cls.instance);
    if (ts.isCallExpression(right))
      for (const argument of right.arguments) properties(argument, cls.instance);
  } else if (!key.startsWith('__')) cls.statics.set(key, right);
}
// Infer static primitives only when every direct write supplies the same kind of
// evidence. A constructor initializer alone cannot establish an instance field's
// lifetime type; those members continue to require reviewed signatures.
for (const { target, value } of mutations) {
  if (!ts.isPropertyAccessExpression(target) && !ts.isElementAccessExpression(target)) continue;
  if (!ts.isIdentifier(target.expression)) continue;
  const cls = classes.get(binding(target.expression));
  if (!cls) continue;
  const key = ts.isPropertyAccessExpression(target)
    ? target.name.text
    : ts.isStringLiteral(target.argumentExpression)
      ? target.argumentExpression.text
      : null;
  if (key === null) {
    cls.dynamicStaticWrite = true;
    continue;
  }
  if (!cls.staticWrites.has(key)) cls.staticWrites.set(key, []);
  cls.staticWrites.get(key).push(value);
}
function primitiveType(node) {
  if (!node) return undefined;
  if (ts.isParenthesizedExpression(node)) return primitiveType(node.expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return 'string';
  if (ts.isNumericLiteral(node)) return 'number';
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword)
    return 'boolean';
  if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';
  if (ts.isPrefixUnaryExpression(node)) {
    if (node.operator === ts.SyntaxKind.ExclamationToken) return 'boolean';
    if (
      (node.operator === ts.SyntaxKind.PlusToken || node.operator === ts.SyntaxKind.MinusToken) &&
      ts.isNumericLiteral(node.operand)
    )
      return 'number';
  }
  return undefined;
}
function staticType(cls, key, node) {
  if (!cls.dynamicStaticWrite) {
    const writes = cls.staticWrites.get(key) ?? [];
    const types = writes.map(primitiveType);
    if (
      types.length &&
      types.every((type) => type !== undefined) &&
      types.some((type) => type !== 'null')
    )
      return [...new Set(types)].sort().join(' | ');
  }
  return type(node);
}
// Haxe instance fields also live in constructors, sometimes absent from prototype.
for (const cls of classes.values()) {
  const constructor = cls.constructor;
  if (!constructor || !ts.isFunctionExpression(constructor)) continue;
  function fields(node) {
    if (node !== constructor && (ts.isFunctionExpression(node) || ts.isArrowFunction(node))) return;
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.expression.kind === ts.SyntaxKind.ThisKeyword &&
      !cls.instance.has(node.left.name.text)
    )
      cls.instance.set(node.left.name.text, node.right);
    ts.forEachChild(node, fields);
  }
  fields(constructor);
}
function signature(node) {
  // Compiled JS erases source types and default-argument information. Do not invent them.
  return `(${node.parameters.map((_, i) => `arg${i}?: any`).join(', ')}) => any`;
}
function type(node) {
  if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) return signature(node);
  return 'any';
}
const ordered = [...classes.values()].sort((a, b) => a.name.localeCompare(b.name));
for (const [name, sections] of Object.entries(signatures)) {
  const cls = ordered.find((entry) => entry.name === name);
  if (!cls) throw new Error(`Typed class disappeared from game: ${name}`);
  for (const [section, members] of Object.entries(sections)) {
    if (section === 'arguments') continue;
    for (const key of Object.keys(members)) {
      if (!cls[section]?.has(key))
        throw new Error(`Typed member disappeared from game: ${name}.${key}`);
    }
  }
}
const lines = [
  '// Generated by scripts/GenerateGameTypes.mjs. Do not edit.',
  "import type { ServicePlayerInfo } from './ServicePlayerInfo';",
  "import type { HaxeIterable } from './HaxeCollections';",
  "import type { PlayerIOChannel, AuthenticationResponse } from './PlayerIOChannel';",
  `// Source SHA-256: ${createHash('sha256').update(source).digest('hex')}`,
  '// Runtime members come from Haxe; types use reviewed signatures and conservative static-write inference.',
  '// Unreconstructed members remain explicitly incomplete; do not treat this as full type coverage.',
  'export interface HaxeObject { readonly __class__: HaxeClass<HaxeObject>; }',
  'export interface HaxeClass<T, Args extends unknown[] = unknown[]> { new (...args: Args): T; readonly prototype: T; readonly __name__: string; readonly __super__?: HaxeClass<HaxeObject>; }',
  'export declare namespace Game {',
];
function reviewedSignature(className, section, member) {
  const members = signatures[className]?.[section];
  return members && Object.hasOwn(members, member) ? members[member] : undefined;
}

function memberName(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}
function instanceMember(name, value, declaration) {
  if (ts.isFunctionExpression(value) && ts.isPropertyAssignment(value.parent)) {
    const prefix = 'type Member = ';
    const parsed = ts.createSourceFile(
      'Member.ts',
      prefix + declaration + ';',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const alias = parsed.statements[0];
    if (ts.isTypeAliasDeclaration(alias) && ts.isFunctionTypeNode(alias.type)) {
      const resultStart = alias.type.type.getStart(parsed) - prefix.length;
      const parameters = declaration
        .slice(0, resultStart)
        .replace(/=>\s*$/, '')
        .trimEnd();
      return `${memberName(name)}${parameters}: ${declaration.slice(resultStart)};`;
    }
  }
  return `${memberName(name)}: ${declaration};`;
}

function emitNamespace(parts, entries, indent) {
  const own = entries.filter((c) => c.name.split('.').length === parts.length + 1);
  for (const cls of own) {
    const name = cls.name.split('.').at(-1);
    const parent = classes.get(cls.parent);
    lines.push(
      `${indent}interface ${name} extends ${parent ? `Game.${parent.name}` : 'HaxeObject'} {`,
    );
    for (const [key, value] of [...cls.instance].sort(([a], [b]) => a.localeCompare(b)))
      lines.push(
        `${indent}  ${instanceMember(key, value, reviewedSignature(cls.name, 'instance', key) ?? type(value))}`,
      );
    lines.push(`${indent}}`);
  }
  const children = [
    ...new Set(
      entries
        .filter((c) => c.name.split('.').length > parts.length + 1)
        .map((c) => c.name.split('.')[parts.length]),
    ),
  ].sort();
  for (const child of children) {
    lines.push(`${indent}namespace ${child} {`);
    emitNamespace(
      [...parts, child],
      entries.filter((c) => c.name.split('.')[parts.length] === child),
      indent + '  ',
    );
    lines.push(`${indent}}`);
  }
}
emitNamespace([], ordered, '  ');
lines.push('}', 'export interface GameClasses {');
for (const cls of ordered) {
  const args = signatures[cls.name]?.arguments;
  lines.push(
    `  ${JSON.stringify(cls.name)}: HaxeClass<Game.${cls.name}${args ? `, ${args}` : ''}> & {`,
  );
  for (const [key, value] of [...cls.statics].sort(([a], [b]) => a.localeCompare(b)))
    lines.push(
      `    ${memberName(key)}: ${reviewedSignature(cls.name, 'statics', key) ?? staticType(cls, key, value)};`,
    );
  lines.push('  };');
}
lines.push(
  '}',
  'export type GameClassName = keyof GameClasses;',
  'export type GameInstance<K extends GameClassName> = InstanceType<GameClasses[K]>;',
  '',
);
await mkdir('src/game', { recursive: true });
await writeFile('src/game/Game.d.ts', lines.join('\n'));
const inferredStatics = ordered.reduce(
  (count, cls) =>
    count +
    [...cls.statics].filter(
      ([key, value]) =>
        reviewedSignature(cls.name, 'statics', key) === undefined &&
        staticType(cls, key, value) !== type(value),
    ).length,
  0,
);
console.log(
  `Generated ${classes.size} reflected classes from ${input}; inferred ${inferredStatics} static primitive fields`,
);
