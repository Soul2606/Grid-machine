import { ItemEntry } from './item-entry.js';


export type Item = string


/**
 * Does not mutate provided values
 */
function squash(items: readonly ItemEntry[]) {
	const squashed = new Map<string, ItemEntry>();
	for (const inst of items) {
		const f = squashed.get(inst.id);
		if (f) {
			f.amount += inst.amount;
		} else {
			squashed.set(inst.id, ItemEntry.from(inst));
		}
	}
	return squashed.values().toArray();
}



export const Item = {
	squash,
} as const
