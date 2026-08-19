import { ItemEntry } from './item-entry';
import type { JSONValue } from '../common/types';
import { JSONEquals } from '../common/utils';
import { getItemFromId } from '../crafting-system/functions';
import type { ItemInstanceSer, Item } from '../crafting-system/types';




export class ItemInstance {

	static from(inst: ItemInstance): ItemInstance {
		return new ItemInstance(inst.item, inst.metadata);
	}

	static fromSer(ref: ItemInstanceSer) {
		const item = getItemFromId(ref.id);
		const meta = ref.metadata === undefined ? null : ref.metadata;
		return new ItemInstance(item, meta);
	}

	static fromItem(item: Item) {
		return new ItemInstance(item);
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

	readonly item: Item;
	metadata: JSONValue;
	constructor(item: Item, metadata: JSONValue = null) {
		this.item = item;
		this.metadata = structuredClone(metadata);
	}

	clone() {
		return new ItemInstance(this.item, this.metadata);
	}

	serialize(): ItemInstanceSer {
		return { id: this.item.id, metadata: this.metadata, amount: 1 };
	}

	isEqual(itemInstance: ItemInstance) {
		if (!(itemInstance instanceof ItemInstance)) throw new Error("itemInstance is not an ItemInstance");
		return (
			this.item.id === itemInstance.item.id
			&&
			JSONEquals(this.metadata, itemInstance.metadata)
		);
	}
}
