import assert from 'node:assert/strict';

// Execute production method bodies with stubbed Flash/Starling boundaries.
// This intentionally supports only the AS3 syntax used by these focused tests.
export function methodSource(source, name) {
    const match = new RegExp(`function (?:get )?${name}\\(([^)]*)\\)[^{]*\\{`).exec(source);
    assert(match, `missing production method ${name}`);
    const begin = match.index + match[0].length;
    const end = source.indexOf('\n    }', begin);
    assert(end > begin, `missing method end ${name}`);
    return {params: match[1], body: source.slice(begin, end)};
}

export function asJavaScript(value) {
    // AS3 keywords inside messages/default strings are data, not syntax.
    const strings = [];
    value = value.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, literal => {
        strings.push(literal);
        return `__AS3_LITERAL_${strings.length - 1}__`;
    });
    return value
        .replace(/new Vector\.<[\w.]+>\(\)/g, '[]')
        .replace(/:\s*(?:Vector\.<[\w.]+>|[A-Z][A-Za-z0-9.]*|int|uint|void|\*)(?=\s*[,;)=\n{]|\s+in\b|$)/g, '')
        .replace(/\s+as\s+[\w.]+/g, '')
        .replace(/\b([\w.]+(?:\[[^\]]+\]|\([^()]*\))?) is ([\w.]+)/g, '__as3Is($1, $2)')
        .replace(/for each\s*\((.*?) in (.*?)\)/g, 'for ($1 of $2)')
        .replace(/__AS3_LITERAL_(\d+)__/g, (_, index) => strings[Number(index)]);
}

export function install(scope, source, names) {
    scope.__as3Is = (value, type) => type === Number ? typeof value === 'number' :
        type === String ? typeof value === 'string' :
        type === Boolean ? typeof value === 'boolean' : value instanceof type;
    for (const name of names) {
        const {params, body} = methodSource(source.replace(/\r/g, ''), name);
        scope[name] = new Function('scope',
            `with (scope) { return function(${asJavaScript(params)}) {${asJavaScript(body)}}; }`)(scope);
    }
    return scope;
}
