type JSONValue = 
 | string
 | number
 | boolean
 | null
 | JSONValue[]
 | { [key: string]: JSONValue|undefined }

type Primitives = "str"|"num"|"bool"|"null"|"any"

export type Config = 
	Primitives
	|{
		type:"record"
		match:Config
	}|{
		type:"obj",
		match:Record<string, Config>,
		optional?:string[],
		strict?:true
	}|{
		type:"arr"
		match:Config
	}|{
		type:"tuple"
		match:Config[]
	}|{
		type:"union"
		match:Config[]
	}


function isObj(val:JSONValue): val is {[key:string]: JSONValue} {
	return (typeof val === "object" && val !== null && !Array.isArray(val))
}

function isArr(val:JSONValue): val is JSONValue[] {
	return Array.isArray(val)
}

function checkPrimTypes(str:string, val:JSONValue) {
	switch (str) {
		case "str":
			return typeof val === "string"
		case "num":
			return typeof val === "number"
		case "bool":
			return typeof val === "boolean"
		case "null":
			return val === null
		default:
			return true
	}
}

type Error = {
	err:string
	at:string
}

function recurse(json:JSONValue, config:Config, path:string[]):Error[] {
	if (config === "any") return []
	const errors:Error[] = []
	const add = (str:string) => errors.push({err:str, at:path.join(".")})
	const conf = config

	if (typeof conf === "string") {
		if (!checkPrimTypes(conf,json)) add("Wrong type")
		return errors
	}

	switch (conf.type) {
		case "obj":
			if (!isObj(json)) {
				add("wrong type")
				break
			}
			if (conf.strict && Object.keys(json).length > Object.keys(conf.match).length) {
				add("too many properties")
			}
			for (const [key, val] of Object.entries(conf.match)) {
				const item = json[key]
				const optional = conf.optional && conf.optional.includes(key)
				if (item === undefined) {
					if (!optional) add(`key "${key}" is missing`)
				} else {
					errors.push(...recurse(item, val, [...path, key]))
				}
			}
			break
		case "record":
			if (!isObj(json)) {
				add("wrong type")
				break
			} 
			for (const [key, val] of Object.entries(json)) {
				errors.push(...recurse(val, conf.match, [...path, key]))
			}
			break
		case "arr":
			if (!isArr(json)) {
				add("wrong type")
				break
			}
			for (const [idx,val] of json.entries()) {
				errors.push(...recurse(val, conf.match, [...path, idx.toString()]))
			}
			break
		case "tuple":
			if (!isArr(json)) {
				add("wrong type")
				break
			}
			if (conf.match.length < json.length) add("Too many items")
			for (const [idx, val] of conf.match.entries()) {
				const item = json.at(idx)
				if (item === undefined) {
					add(`item at index "${idx}" is missing`)
				} else {
					errors.push(...recurse(item, val, [...path, idx.toString()]))
				}
			}
			break
		case "union":
			const unionErrors:Error[] = []
			let success = false
			for (const match of conf.match) {
				const err = recurse(json, match, path)
				if (err.length === 0) {
					success = true
					break
				}
				unionErrors.push(...err)
			}
			if (unionErrors.length > 0 && !success) {
				add(`no type in union is valid. ${unionErrors.map(err => `${err.err} at ${err.at}`).join(", ")}`)
			}
			break
	}
	return errors
}



export function validate(json:JSONValue, config:Config) {
	return recurse(json, config, ["$"])
}


type TupleHas<O extends readonly unknown[], K> =
	Extract<O[number], K> extends never
		? false
		: true


export type ConfType<T> = 
	T extends "str"  ? string :
	T extends "num"  ? number :
	T extends "bool" ? boolean :
	T extends "null" ? null :
	T extends "any"  ? JSONValue :
	T extends {type:"record", match: infer M extends Config} ?
		Record<
			string,
			ConfType<M>
		> :
	T extends {type: "obj", match: infer M extends Record<string, Config>, optional?: infer O extends string[]|undefined} ?
		{
			[K in keyof M]: O extends string[] ? TupleHas<O, K> extends true ? ConfType<M[K]>|undefined : ConfType<M[K]> : ConfType<M[K]>
		} :
	T extends {type:"arr", match: infer M extends Config} ?
		ConfType<M>[] :
	T extends {type:"tuple", match: infer M extends Config[]} ?
		{
			[K in keyof M]: ConfType<M[K]>
		} :
	T extends {type:"union", match: infer M extends Config[]} ?
		ConfType<M[number]> :
	unknown

