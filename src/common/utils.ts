import type { JSONValue } from "./types";




export function get<T extends HTMLElement = HTMLElement>(id: string) {
	const el = document.getElementById(id);
	if (!el) {
		throw new Error(`Cannot get element from id: ${id}`);
	}
	return el as T;
}




export function getAll<T extends HTMLElement = HTMLElement>(className: string) {
	return Array.from(document.querySelectorAll<T>("." + className));
}




export function create<K extends keyof HTMLElementTagNameMap>(
	element: K,
	ns?: string
): HTMLElementTagNameMap[K] {
	if (ns) return document.createElementNS(ns, element) as HTMLElementTagNameMap[K];
	return document.createElement(element);
}




export function relu(x: number) {
	return Math.max(x, 0);
}




export function removeAllChildren(element: HTMLElement) {
	while (element.hasChildNodes()) {
		element.firstChild?.remove();
	}
}




type WalkJsonArgs = {
	key: string | number | null;
	value: JSONValue;
	parent: null | Record<string, JSONValue> | JSONValue[];
	path: readonly (string | number)[];
	isLeaf: false;
	mutateValue: (newValue: JSONValue) => void;
	mutateKey: (newKey: string | number) => void;
} | {
	key: string | number | null;
	value: string | number | null | boolean;
	parent: null | Record<string, JSONValue> | JSONValue[];
	path: readonly (string | number)[];
	isLeaf: true;
	mutateValue: (newValue: JSONValue) => void;
	mutateKey: (newKey: string | number) => void;
};
export function walkJson(obj: JSONValue, fnc: (args: WalkJsonArgs) => void): void {
	type Parental = null |
	{ readonly kind: "object"; readonly key: string; readonly value: Record<string, JSONValue>; } |
	{ readonly kind: "array"; readonly key: number; readonly value: JSONValue[]; };

	const recurse = (
		current: JSONValue,
		parent: Parental = null,
		path: Array<string | number> = []
	) => {
		const mutateValue = (newValue: JSONValue) => {
			if (parent === null) return false;
			if (parent.kind === "object") {
				parent.value[parent.key] = newValue;
			} else {
				parent.value[parent.key] = newValue;
			}
			return true;
		};

		const mutateKey = (newKey: string | number) => {
			if (parent === null) return false;
			if (parent.kind === "object") {
				if (typeof newKey === "number") return false;
				delete parent.value[parent.key];
			}
			if (parent.kind === "array") {
				if (typeof newKey === "string") return false;
				parent.value.splice(parent.key, 1);
			}
			//@ts-ignore
			parent.value[newKey] = current;
			return true;
		};

		const isLeaf = current === null || typeof current === "number" || typeof current === "boolean" || typeof current === "string";
		fnc({
			key: parent ? parent.key : null,
			value: current as any,
			parent: parent ? parent.value : null,
			path,
			isLeaf,
			mutateValue,
			mutateKey
		});

		// Recurse into children if object/array
		if (Array.isArray(current)) {
			current.forEach((val, idx) => recurse(val, { value: current, key: idx, kind: "array" }, [...path, idx]));
		} else if (typeof current === 'object') {
			for (const key in current) {
				const next = current[key];
				if (next === undefined) continue;
				recurse(next, { value: current, key, kind: "object" }, [...path, key]);
			}
		}
	};

	return recurse(obj, null, []);
}




export function JSONEquals(obj1: JSONValue, obj2: JSONValue): boolean {
	function tupleToString(arr: readonly (string | number)[]): string {
		return arr
			.map(v => typeof v === "string" ? `'${v}'` : String(v))
			.join(",");
	}

	function setEquals(a: Set<string>, b: Set<string>): boolean {
		if (a.size !== b.size) return false;
		for (const v of a) {
			if (!b.has(v)) return false;
		}
		return true;
	}


	const pathMap = new Map<string, unknown>();
	const paths = new Set<string>();

	walkJson(obj1, ({ value, path }) => {
		pathMap.set(tupleToString(path), value);
	});

	let mismatch = false;
	walkJson(obj2, ({ value, path }) => {
		paths.add(tupleToString(path));
		const value2 = pathMap.get(tupleToString(path));
		if (!pathMap.has(tupleToString(path))) mismatch = true;
		if (value2 !== value && typeof value !== 'object' && typeof value2 !== 'object') mismatch = true;
	});
	if (mismatch) return false;

	return setEquals(new Set(pathMap.keys()), paths);
}




export function clamp(val: number, min: number = 0, max: number = 1) {
	const validate = (n: number) => {
		if (Number.isNaN(n)) throw new Error("type error. value must be a number");
		if (typeof n !== 'number') throw new Error("type error. value must be a number");
	};
	validate(val);
	validate(min);
	validate(max);
	return Math.max(min, Math.min(max, val));
}




/**
 * Converts a string of energy in joules to a number
 */
export function energyToNumber(energyString: string): number {
	const prefix = energyString.slice(-2);
	const value = energyString.slice(0, -2);
	if ({ kJ: 1000, MJ: 1000000, GJ: 1000000000 }[prefix] === undefined || !Number.isFinite(Number(value))) return 0;
	const multiplier = { kJ: 1000, MJ: 1000000, GJ: 1000000000 }[prefix];
	if (!multiplier) throw new Error("Invalid energy prefix, must be 'kJ, MJ or GJ'");
	return Number(value) * multiplier;
}




/**
 * returns an exponentially bigger number based on how big n is.
 * @param n which step.
 * @returns the value of the step
 */
export function stepExponential(max: number): number[] {

	//1 2 3 4 5 6 7 8 9 10 20 30...
	function expo1234(max: number) {
		const result: number[] = [];
		let power = 0;
		while (power < 1000) {
			const scale = 10 ** power;
			for (let i = 1; i <= 9; i++) {
				const value = i * scale;
				if (value >= max) {
					result.push(max);
					return result;
				}
				result.push(value);
			}
			power++;
		}
		throw new Error("Failed to resolve exponential");
	}

	//1 2 5 10 20 50 100...
	function expo125(max: number) {
		const result: number[] = [];
		const bases = [1, 2, 5];
		let power = 0;
		while (power < 1000) {
			const scale = 10 ** power;
			for (const b of bases) {
				const value = b * scale;
				if (value > max) {
					if (result[result.length - 1] !== max) {
						result.push(max);
					}
					return result;
				}
				result.push(value);
			}
			power++;
		}
		throw new Error("Failed to resolve exponential");
	}

	if (max <= 500) {
		return expo1234(max);
	} else {
		return expo125(max);
	}
}




