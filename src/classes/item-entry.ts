import { Item } from './item.js';
import type { JSONValue } from '../common/types';
import type { ItemDef } from '../game-data.js';




export type ItemEntry = Item & {
	amount:number
}

function n(id: string, metadata: JSONValue, amount: number):ItemEntry {
	return {
		id,
		metadata:structuredClone(metadata),
		amount
	}
}

function from(ent: ItemEntry) {
	return ItemEntry.n(ent.id, structuredClone(ent.metadata), ent.amount);
}

function fromInst(inst: Item, amount: number) {
	return ItemEntry.n(inst.id, structuredClone(inst.metadata), amount);
}

function fromItem(item: ItemDef, amount: number = 1) {
	return ItemEntry.n(item.id, null, amount);
}

function strictEquals(ent1:ItemEntry, ent2:ItemEntry) {
	return Item.isEqual(ent1, ent2) && ent2.amount === ent1.amount;
}

export const ItemEntry = {
	n,
	from,
	fromInst,
	fromItem,
	strictEquals,
	squash:Item.squash
} as const
