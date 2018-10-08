import 'allocator/arena'

import { tokeq, parse, TestToken } from './testutil'
import { JsmnToken, JsmnParser, JsmnType, JsmnErr, jsmnParse, jsmn_fill_token, jsmn_alloc_token } from  '../index'

declare namespace env {
  function debug(arg: i32, len: i32): void
  function debug_int(msg: i32): void;
}

let token: JsmnToken = {
  type: JsmnType.JSMN_OBJECT,
  start: 0,
  end: 2,
  size: 2,
  parent: 0,
}

let testToken: TestToken = {
  type: JsmnType.JSMN_OBJECT,
  start: 0,
  end: 2,
  size: 2,
  value: '{}'
}

function check(val: boolean): i32 {
  return val ? 0 : -1;
}

export function debug(msg: string): void {
  env.debug(changetype<i32>(msg)+4, msg.length);
}

export function debug_int(msg: i32): void {
  env.debug_int(msg);
}




export function test_fill_token(): i32 {
  let token: JsmnToken = new JsmnToken();
  jsmn_fill_token(token, JsmnType.JSMN_PRIMITIVE, 1, 2);
  return check(
    token.type == JsmnType.JSMN_PRIMITIVE 
    && token.start == 1 
    && token.end == 2
    && token.size == 0)
}

export function test_call_parse(): i32 {
  return jsmnParse(new JsmnParser(), "", 0, [], 0);
}

/*====================================
=            Ported Tests            =
====================================*/

/*----------  test_empty  ----------*/


export function test_empty_1(): i32 {
  return check(parse('{}\0', 1, 1,
        [{type: JsmnType.JSMN_OBJECT, start: 0, end: 2, size: 0, value: ''}]));
}
export function test_empty_2(): i32 {
  return check(parse('[]\0', 1, 1,
        [{type: JsmnType.JSMN_ARRAY, start: 0, end: 2, size: 0, value: ''}]));
}
export function test_empty_3(): i32 {
  return check(parse('[{},{}]\0', 3, 3,
        [{type: JsmnType.JSMN_ARRAY, start: 0, end: 7, size: 2, value: ''},
          {type: JsmnType.JSMN_OBJECT, start: 1, end: 3, size: 0, value: ''},
          {type: JsmnType.JSMN_OBJECT, start: 4, end: 6, size: 0, value: ''}]));
}

/*----------  test_object  ----------*/

// export function test_object_1(): i32 {
//   return check(parse('{"a":0}\0', 3, 3,
//         [{type: JsmnType.JSMN_OBJECT, start: 0, end: 7, size: 1, value: ''},
//           {type: JsmnType.JSMN_STRING, start: -1, end: -1, size: -1, value: 'a'},
//           {type: JsmnType.JSMN_PRIMITIVE, start: -1, end: -1, size: -1, value: '0'}]));
// }
// export function test_object_2(): i32 {
//   return check(parse('{"a":[]}\0', 3, 3,
//         [{type: JsmnType.JSMN_OBJECT, start: 0, end: 8, size: 1, value: ''},
//           {type: JsmnType.JSMN_STRING, start: -1, end: -1, size: 1, value: 'a'},
//           {type: JsmnType.JSMN_PRIMITIVE, start: 5, end: 7, size: 0, value: ''}]));
// }

/*----------  test_array  ----------*/

// export function test_array_1(): i32 {
//   return check(parse('[10]\0', 2, 2,
//         [{type: JsmnType.JSMN_ARRAY, start: -1, end: -1, size: 1, value: ''},
//         {type: JsmnType.JSMN_PRIMITIVE, start: 0, end: 0, size: 0, value: '10'}]));
// }

// export function test_array_2(): i32 {
//   return check(parse('{"a": 1]\0', JsmnErr.JSMN_ERROR_INVAL, 3, [])); 
// }


/*=====  End of Ported Tests  ======*/
