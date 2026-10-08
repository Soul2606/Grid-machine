import { Item } from './item.js';
import type { ItemDef } from '../game-data.js';

export type ItemEntry = {
	id:string
	amount:number
}

function n(id: string, amount: number):ItemEntry {
	return {
		id,
		amount
	}
}

function from(ent: ItemEntry) {
	return ItemEntry.n(ent.id, ent.amount);
}

function fromInst(inst: Item, amount: number) {
	return ItemEntry.n(inst, amount);
}

function fromItem(item: ItemDef, amount: number = 1) {
	return ItemEntry.n(item.id, amount);
}

function strictEquals(ent1:ItemEntry, ent2:ItemEntry) {
	return (ent1.id === ent2.id) && ent2.amount === ent1.amount;
}

export const ItemEntry = {
	n,
	from,
	fromInst,
	fromItem,
	strictEquals,
	squash:Item.squash
} as const
