import { Item } from './item.js';
import type { JSONValue } from '../common/types';
import { getItemFromId } from '../crafting-system/functions.js';
import type { ItemSer } from '../crafting-system/types';
import type { ItemDef } from '../game-data.js';




export class ItemEntry extends Item {

	static from(ent: ItemEntry) {
		return new ItemEntry(ent.item, structuredClone(ent.metadata), ent.amount);
	}

	static fromInst(inst: Item, amount: number) {
		return new ItemEntry(inst.item, structuredClone(inst.metadata), amount);
	}

	static fromItem(item: ItemDef, amount: number = 1) {
		return new ItemEntry(item, null, amount);
	}

	static fromSer(ref: ItemSer) {
		const item = getItemFromId(ref.id);
		const meta = ref.metadata === undefined ? null : ref.metadata;
		const amount = ref.amount === undefined ? 0 : ref.amount;
		return new ItemEntry(item, meta, amount);
	}

	amount: number;
	constructor(item: ItemDef, metadata: JSONValue, amount: number) {
		super(item, metadata);
		this.amount = amount;
	}

	clone(): ItemEntry {
		return new ItemEntry(this.item, this.metadata, this.amount);
	}

	serialize(): ItemSer {
		return { id: this.item.id, metadata: this.metadata, amount: this.amount };
	}

	strictEquals(ent: ItemEntry) {
		return this.isEqual(ent) && this.amount === ent.amount;
	}
}
