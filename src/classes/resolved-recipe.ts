import { ItemEntry } from './item-entry';
import type { ResolvedRecipeSer } from "../crafting-system/types";

/**
 * A fully resolved, irreversible execution of a single recipe.
 *
 * - Inputs and outputs are fixed and exact.
 * - id: is the id from the recipe that was resolved
 *
 * This is the authoritative result produced by recipe resolution.
 */




export class ResolvedRecipe {

	static fromSer(ser: ResolvedRecipeSer) {
		return new ResolvedRecipe(
			ser.time,
			ser.inputs.map(ItemEntry.fromSer),
			ser.output.map(ItemEntry.fromSer)
		);
	}

	static squash(val: readonly ResolvedRecipe[]) {
		const arr: {
			amount: number;
			value: ResolvedRecipe;
		}[] = [];

		for (const r of val) {
			const exist = arr.find(v => v.value.equals(r));
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

	/**This is not an identifier of this class. Its the id of the recipe that this resolved from. Use the `equals` method instead. */
	readonly time: number;
	readonly inputs: readonly ItemEntry[];
	readonly output: readonly ItemEntry[];
	constructor(
		time: number,
		inputs: readonly ItemEntry[],
		output: readonly ItemEntry[]
	) {
		this.time = time;
		this.inputs = inputs;
		this.output = output;
	}

	serialize(): ResolvedRecipeSer {
		return {
			time: this.time,
			inputs: this.inputs.map(ent => ent.serialize()),
			output: this.output.map(ent => ent.serialize())
		};
	}

	equals(rr: ResolvedRecipe) {
		return this.time === rr.time &&
			this.inputs.length == rr.inputs.length &&
			this.inputs.every(inp => rr.inputs.some(i => inp.strictEquals(i))
			) &&
			this.output.every(out => rr.output.some(i => out.strictEquals(i))
			);
	}
}
