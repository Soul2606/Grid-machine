import { ItemEntry } from './item-entry.js';


export type ResolvedRecipe = {
	readonly time: number;
	readonly inputs: readonly ItemEntry[];
	readonly outputs: readonly ItemEntry[];
}


/**
 * A fully resolved, irreversible execution of a single recipe.
 *
 * - Inputs and outputs are fixed and exact.
 * - id: is the id from the recipe that was resolved
 *
 * This is the authoritative result produced by recipe resolution.
 */
export const ResolvedRecipe = {
	n,
	squash,
	equals,
}

function n(time:number, inputs:readonly ItemEntry[], outputs:readonly ItemEntry[]) {
	return {
		time,
		inputs:structuredClone(inputs),
		outputs:structuredClone(outputs)
	} satisfies ResolvedRecipe
}

function squash(val: readonly ResolvedRecipe[]) {
	const arr: {
		amount: number;
		value: ResolvedRecipe;
	}[] = [];

	for (const r of val) {
		const exist = arr.find(v => ResolvedRecipe.equals(v.value, r));
		if (exist) {
			exist.amount++;
		} else {
			arr.push({
				amount: 1,
				value: r,
			});
		}
	}

	return arr;
}

function equals(rr1: ResolvedRecipe, rr2: ResolvedRecipe) {
	return rr2.time === rr1.time &&
	rr2.inputs.length == rr1.inputs.length &&
	rr2.inputs.every(inp => rr1.inputs.some(i => ItemEntry.strictEquals(inp, i))) &&
	rr2.outputs.every(out => rr1.outputs.some(i => ItemEntry.strictEquals(out, i)));
}

