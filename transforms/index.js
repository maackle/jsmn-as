const fs = require('fs')
const path = require('path')
const {
  CommonFlags,
  MethodDeclaration,
  Node,
  NodeKind,
  SourceKind,
  TypeKind,
  parseFile
} = require('assemblyscript');

const show = x => {throw Error(JSON.stringify((x)))}
const showKeys = x => {throw Error(JSON.stringify(Object.keys(x)))}

exports.afterParse = function(parser) {

  const entrySrcIdx = parser.program.sources.findIndex(s => s.isEntry)
  const entrySrc = parser.program.sources[entrySrcIdx]

  const deserializableClasses = {}

  entrySrc.statements.forEach(s => {
    if (
      s.kind === NodeKind.CLASSDECLARATION &&
      s.decorators &&
      s.decorators.length &&
      s.decorators.some(d => d.name.text === "deserializable")
    ) {
      if (s.isGeneric) {
        throw Error("Generic classes are not currently @deserializable")
      }

      const fields = []
      s.members.forEach(m => {
        if (m.kind === NodeKind.FIELDDECLARATION) {
          const name = m.name.text
          const type = m.type.name.text
          const typeArgs = m.type.typeArguments.map(t => t.name.text)
          fields.push([m.name.text, type, ...typeArgs])
        }
      })

      deserializableClasses[s.name.text] = fields
    }
  })

  let code = builtinUnmarshalFuncs(deserializableClasses)

  entrySrc.statements.forEach(s => {
    if (
      s.kind === NodeKind.CLASSDECLARATION &&
      s.decorators &&
      s.decorators.length &&
      s.decorators.some(d => d.name.text === "deserializable")
    ) {
      const name = s.name.text
      code += customUnmarshal(name, deserializableClasses[name])
      // const unmarshalStmt = parseStatements(entrySrc, unmarshalCode)[0]
      // const method = Node.createMethodDeclaration(
      //   unmarshalStmt.name,
      //   null,
      //   unmarshalStmt.signature,
      //   unmarshalStmt.body,
      //   null,
      //   CommonFlags.STATIC,
      //   entrySrc.range  // TODO
      // )
      // s.members.push(method)
      // entrySrc.statements.push(unmarshalStmt)
    }
  })

  // entrySrc.statements.forEach(s => {
  //   if (s.kind === NodeKind.EXPRESSION && s.expression.kind === NodeKind.CALL) {
  //     const funcName = s.expression.expression.text
  //     if (funcName === 'unmarshal') {
  //       const args = s.expression.arguments.map(a => a.text)
  //       const typeName = s.expression.typeArguments[0].name.text
  //       const typeArgs = []//s.expression.typeArguments.map(t => t.name.text)
  //       const code = `unmarshal_${typeName}(${args[0]}, ${args[1]})`
  //       const statement = parseStatements(entrySrc, code)[0]
  //       // rewrite function body
  //       s.expression = statement.expression
  //     }
  //   }
  // })

  console.log('*** *** *** *** *** ')
  console.log(code)
  console.log('*** *** *** *** *** ')
  const stmts = parseStatements(entrySrc, code)

  // add the new function to the AST as an exported function
  entrySrc.statements.push(...stmts);

  // show(deserializableClasses)

}

// {"S":[["a","i32"]],"T":[["s","S"]],"Arr":[["ss","Array","S"],["t","T"]]}

function builtinUnmarshalFuncs() {
  const prelude = `
@inline
function tokenVal(json: string, tok: JsmnToken): string {
  return json.substring(tok.start, tok.end)
}

  `
  const primitives = ([
    ['i32', 'parseI32(val, 10)'],
    ['u32', 'parseI32(val, 10)'],
    ['i64', 'parseI64(val, 10)'],
    ['u64', 'parseI64(val, 10)'],
    ['f32', 'parseFloat(val)'],
    ['f64', 'parseFloat(val)'],
    ['string', 'val'],
    ['boolean', '(val == "true")'],
    // ['null', '(val == "null" ? 0 : -1)'],
  ]).map(([inType, stmt]) => {
    const fn = unmarshalCallSwitch(inType)
    return `
@inline
function unmarshal_${inType}(json: string, toks: Array<JsmnToken>): ${inType} {
  let val = tokenVal(json, toks.shift())
  return ${stmt} as ${inType}
}

${ genUnmarshalArrayFunc(inType) }
    `
  }).join('\n')
  return prelude + primitives
}


function genUnmarshalArrayFunc(inType) {
  const fn = unmarshalCallSwitch(inType)
  return `

function unmarshal_array_${inType}(json: string, toks: Array<JsmnToken>): Array<${inType}> {
  let arrTok = toks.shift()
  assert(arrTok.type === JsmnType.JSMN_ARRAY)
  // TODO: check for empty array
  let arr = new Array<${inType}>()
  while (toks.length > 0 && toks[0].type != JsmnType.JSMN_UNDEFINED && toks[0].start < arrTok.end) {
    let v = ${fn}(json, toks)
    arr.push(v)
  }
  return arr
}
  `
}

function unmarshalCallSwitch(typeName, typeArgs) {
  switch(typeName) {
    case 'i32':
    case 'u32':
      return 'unmarshal_i32'
    case 'i64':
    case 'u64':
      return 'unmarshal_i64'
    case 'f32':
      return 'unmarshal_f32'
    case 'f64':
      return 'unmarshal_f64'
    case 'string':
      return 'unmarshal_string'
    case 'Array':
      const targ = typeArgs[0]
      return `unmarshal_array_${targ}`
    default:
      return `unmarshal_${typeName}`
  }
}

function jsmnTypeSwitch(typeName) {
  switch(typeName) {
    case 'boolean':
    case 'i32':
    case 'u32':
    case 'i64':
    case 'u64':
    case 'f32':
    case 'f64':
      return 'JsmnType.JSMN_PRIMITIVE'
    case 'string':
      return 'JsmnType.JSMN_STRING'
    case 'Array':
      return 'JsmnType.JSMN_ARRAY'
    default:
      // TODO: check for invalid
      return 'JsmnType.JSMN_OBJECT'
  }
}

function parametricTypeString(name, args) {
  return args && args.length > 0 ? `${name}<${args.join(',')}>` : name
}

function customUnmarshal(ty, struct) {

  const conditions = struct.map(([key, typeName, ...typeArgs]) => {
    const parseCall = unmarshalCallSwitch(typeName, typeArgs)
    const jsmnType = jsmnTypeSwitch(typeName)
    const dbg = key === 'c' ? `debug_int( (obj.${key}.length) )` : ''
    return `(key == '${key}') {
      assert(valTok.type === ${jsmnType})
      obj.${key} = ${parseCall}(json, toks)
      ${ dbg }
    }`
  })

  const elseStatement = ` else { debug("OH NO: " + '${ty}' + " / " + key) }`
  const conditionCode = 'if ' + conditions.join(' else if ') + elseStatement

  return `
function unmarshal_${ty}(json: string, toks: Array<JsmnToken>): ${ty} {
  let obj = new ${ty}()
  let objTok = toks.shift()
  assert(objTok.type === JsmnType.JSMN_OBJECT)
  // TODO: check for empty object

  do {
    let keyTok: JsmnToken = toks.shift()
    let valTok: JsmnToken = toks[0]
    let key = tokenVal(json, keyTok)
    let val = tokenVal(json, valTok)
    // debug("COND: ${ty} / " + key /* + " " + keyTok.start + " " + valTok.start */)

    // *** begin generated conditionals ***
    ${ conditionCode }
    // ***  end generated conditionals  ***

  } while(toks.length > 0 && toks[0].type != JsmnType.JSMN_UNDEFINED && toks[0].start < objTok.end)
  return obj
}

${ genUnmarshalArrayFunc(ty) }
  `
}

function parseStatements(entrySrc, code) {
  return parseFile(
    code,
    entrySrc.range.source.normalizedPath,
    false,
    null
  ).program.sources[0].statements
}
