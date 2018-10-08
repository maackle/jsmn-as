import { JsmnToken, JsmnParser, JsmnType, JsmnErr, jsmnParse } from  '../index'
import { debug, debug_int } from './index'


export class TestToken {
	type: JsmnType
	value: string
	size: i32
	start: i32
	end: i32
}


export function tokeq(s: string, tokens: Array<JsmnToken>, numtok: i32, expected: Array<TestToken>): boolean {
	if (numtok > 0) {
		for (let i: i32 = 0; i < numtok; i++) {

			if (tokens[i].type != expected[i].type) {
				debug("token type not correct. Actual type was");
				debug_int(tokens[i].type)
				debug("expecting")
				debug_int(expected[i].type)
				return false;
			}
			if (expected[i].start >= 0 && expected[i].end >= 0) {
				if (tokens[i].start != expected[i].start) {
					debug("token start not correct. Actual start was");
					debug_int(tokens[i].start)
					debug("expecting")
					debug_int(expected[i].start)
					return false;
				}
				if (tokens[i].end != expected[i].end ) {
					debug("token end not correct. Actual end was");
					debug_int(tokens[i].end)
					debug("expecting")
					debug_int(expected[i].end)
					return false;
				}
			}
			if (expected[i].size && tokens[i].size != expected[i].size) {
				debug("token size not correct. Actual size was");
				debug_int(tokens[i].size)
				debug("expecting")
				debug_int(expected[i].size)
				return false;
			}

			if (s != '' && expected[i].value != '') {
				if (expected[i].value != s.substring(tokens[i].start, tokens[i].end)) {
					debug("token value not correct. Actual value was");
					debug(s.substring(tokens[i].start, tokens[i].end))
					debug("expecting")
					debug(expected[i].value)
					return false;
				}
			}
		}
	}
	return true;
}


export function parse(s: string, status: i32, numtok: i32, expected: Array<TestToken>): boolean {
	let r: i32;
	let ok: boolean = false;
	let p: JsmnParser = new JsmnParser();
	let t: Array<JsmnToken> = new Array<JsmnToken>(numtok);

	r = jsmnParse(p, s, s.length, t, numtok);
	if (r != status) {
		// printf("status is %d, not %d\n", r, status);
		return false
	}

	if (status >= 0) {
		ok = tokeq(s, t, numtok, expected); 
	}

	// memory.free(); // free the stuff we allocated
	return ok;
}