import { Signal, type SignalInterface } from '../lib/events/signal.js';
import { ItemEntry } from './item-entry.js';
import { Item } from './item.js';

/**
 * Class for managing data of item instances. inventory can be constructed and configured before compilation.
 */



export class Inventory {
	private itemInstances: ItemEntry[]; // !!!!Important!!!! The actual items in the inventory
	private readonly max: number; // Max for each item, not amount in total
	private readonly maxSlots: number; // Max amount of different items
	private readonly contentChangeSignal: Signal<ItemEntry>;
	readonly signal: SignalInterface<ItemEntry, void>;
	constructor(
		max: number = Infinity,
		maxSlots: number = Infinity
	) {
		if (typeof max !== 'number') throw new Error("max must be a number");
		if (typeof maxSlots !== 'number') throw new Error("maxSlots must be a number");
		if (Number.isNaN(max)) throw new Error("max must be a valid number");
		if (max < 1) throw new Error("max must be a natural number");

		this.itemInstances = [];
		this.contentChangeSignal = new Signal<ItemEntry>();
		this.signal = this.contentChangeSignal.createInterface(true);
		this.max = Math.ceil(max);
		this.maxSlots = Math.ceil(maxSlots);
	}

	/**
	 * Finds an instance of the item in !ONLY THIS! inventory. Use with caution, this returns direct references!
	 */
	private findInstance(item: Item) {
		return this.itemInstances.find(entry => entry.isEqual(item));
	}

	// ====== Execution ======
	clear() {
		this.itemInstances = [];
		return this;
	}

	/**
	 * Used to add/subtract an item from inventory.
	 * @param item Item instance to be added to inventory
	 * @param amount negative integers
	 * @param dryRun If true then no item will be added but you will still get the success value
	 * @returns success
	 */
	changeItem(item: Item, amount: number, dryRun: boolean = false): boolean {
		if (!Number.isInteger(amount)) return false;

		const existing = this.findInstance(item);

		if (!existing) {
			if (this.itemInstances.length + 1 > this.maxSlots) return false;
			if (amount > this.max) return false;
			if (amount < 0) return false;
			if (!dryRun) this.itemInstances.push(ItemEntry.fromInst(item, amount));
		} else {
			const nextAmount = existing.amount + amount;
			if (nextAmount < 0 || nextAmount > this.max) return false;
			if (!dryRun) {
				existing.amount = nextAmount;
				if (existing.amount === 0) {
					this.itemInstances.splice(this.itemInstances.indexOf(existing), 1);
				}
			}
		}
		this.contentChangeSignal.send(this.getReflection(item));
		return true;
	}

	addItem(item: Item, amount: number): boolean {
		return this.changeItem(item, amount);
	}

	subtractItem(item: Item, amount: number): boolean {
		return this.changeItem(item, -amount);
	}

	/**
	 * Tries to change every item at once. if any item can't be changed then nothing gets changed and it returns false
	 */
	changeItems(items: readonly ItemEntry[]): boolean {
		if (items.every(item => this.changeItem(item, item.amount, true))) { // This check is not strong enough. Even if every item can be added individually, then that does not mean they can all be added at once
			for (const itemInstance of items) {
				if (!this.changeItem(itemInstance, itemInstance.amount)) throw new Error("Invariant broken: inventory may be unpredictably mutated");
			}
			return true;
		}
		return false;
	}

	/**
	 * Tries to add every item at once. if any item can't be added then nothing gets added and it returns false
	 */
	addItems(items: readonly ItemEntry[]): boolean {
		return this.changeItems(items);
	}

	/**
	 * Tries to subtract every item at once. if any item can't be subtracted then nothing gets subtracted and it returns false
	 */
	subtractItems(items: readonly ItemEntry[]): boolean {
		return this.changeItems(items.map(v => new ItemEntry(v.item, v.metadata, -v.amount)));
	}

	// ====== Queries ======
	getLength() {
		return this.itemInstances.length;
	}

	getMax() {
		return this.max;
	}

	getMaxSlots() {
		return this.maxSlots;
	}

	hasInstance(item: Item) {
		return this.getReflection(item).amount > 0;
	}

	/**
	 * Returns an item based on content in this and shared inventories, does not return direct reference
	 */
	getReflection(item: Item): ItemEntry {
		const instance = this.getAllItemInstances().find(v => v.isEqual(item));
		if (instance) return instance.clone();
		return ItemEntry.fromInst(item, 0);
	}

	getAmount(item: Item): number {
		return this.getReflection(item).amount;
	}

	/**
	 * Returns item instances based on content in this and shared inventories, does not return direct reference
	 */
	getAllItemInstances() {
		return this.itemInstances.map(ent => ItemEntry.from(ent));
	}

	/**
	 * Return weather a change is possible without actually changing the content of the inventory
	 */
	canChange(item: Item, amount: number): boolean {
		// For the sake of clarity
		return this.changeItem(item, amount, true);
	}

	capacityFor(item: Item): number {
		const existing = this.hasInstance(item);
		return !existing && this.maxSlots === this.itemInstances.length ?
			0 :
			this.max - this.getAmount(item);
	}

	/**Creates a clone with no shared references (including all internal entries). */
	clone() {
		const newI = new Inventory(
			this.max,
			this.maxSlots
		);
		if (!newI.addItems(this.getAllItemInstances())) console.warn('cannot clone item contents');
		return newI;
	}

	/**
	 * Copies and overwrites content from provided inventory to this inventory
	 */
	copyContent(inv: Inventory) {
		this.itemInstances = inv.getAllItemInstances();
		return this;
	}
}
