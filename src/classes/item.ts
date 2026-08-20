import { ItemEntry } from './item-entry';
import type { JSONValue } from '../common/types';
import { JSONEquals } from '../common/utils';
import { getItemFromId } from '../crafting-system/functions';
import type { ItemSer } from '../crafting-system/types';
import type { ItemDef } from '../game-data';




export class Item {

	static from(inst: Item): Item {
		return new Item(inst.item, inst.metadata);
	}

	static fromSer(ref: ItemSer) {
		const item = getItemFromId(ref.id);
		const meta = ref.metadata === undefined ? null : ref.metadata;
		return new Item(item, meta);
	}

	static fromItem(item: ItemDef) {
		return new Item(item);
	}

	/**
	 * Does not mutate provided values
	 */
	static squash(items: readonly ItemEntry[]) {
		const squashed = new Map<string, ItemEntry>();
		for (const inst of items) {
			const f = squashed.get(inst.item.id);
			if (f) {
				f.amount += inst.amount;
			} else {
				squashed.set(inst.item.id, ItemEntry.from(inst));
			}
		}
		return squashed.values().toArray();
	}

	readonly item: ItemDef;
	metadata: JSONValue;
	constructor(item: ItemDef, metadata: JSONValue = null) {
		this.item = item;
		this.metadata = structuredClone(metadata);
	}

	clone() {
		return new Item(this.item, this.metadata);
	}

	serialize(): ItemSer {
		return { id: this.item.id, metadata: this.metadata, amount: 1 };
	}

	isEqual(itemInstance: Item) {
		if (!(itemInstance instanceof Item)) throw new Error("itemInstance is not an ItemInstance");
		return (
			this.item.id === itemInstance.item.id
			&&
			JSONEquals(this.metadata, itemInstance.metadata)
		);
	}
}
