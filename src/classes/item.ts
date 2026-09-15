import { ItemEntry } from './item-entry.js';
import type { JSONValue } from '../common/types';
import { JSONEquals } from '../common/utils.js';
import type { ItemDef } from '../game-data';




export type Item = {
	readonly id: string;
	metadata: JSONValue;
}

function n(id: string, metadata: JSONValue = null) {
	return {
		id,
		metadata:structuredClone(metadata)
	} satisfies Item
}

function from(item: Item): Item {
	return Item.n(item.id, item.metadata);
}

function fromItem(item: ItemDef) {
	return Item.n(item.id);
}

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

function isEqual(item1:Item, item2:Item) {
	return (
		item2.id === item1.id
		&&
		JSONEquals(item2.metadata, item1.metadata)
	);
}

export const Item = {
	n,
	from,
	fromItem,
	squash,
	isEqual,
} as const
