import { getItemFromId, JSONEquals, energyToNumber, maxCraftableCount, getRecipeInputs, resolveCraftingCosts, getRecipeOutputs, relu } from './functions.js';
import type { Item, ItemInstanceSer, JSONValue, Machine, MachineInstanceSer, Recipe } from './types.js';




/**
 * Class for managing data of item instances. inventory can be constructed and configured before compilation. Do not try to modify or access item instances before compilation.
 */
export class Inventory {
	#itemInstances: ItemInstance[];
	#contentChangeCallback: (inst: ItemInstance)=>void;

	// Cannot be changed after construction
	#max: number;
	#maxSlots: number;
	#itemsFilter: Item[];
	#tagsFilter: string[];
	constructor(
		contentChangeCallback: (inst: ItemInstance)=>void = () => {},
		max: number = Infinity,
		itemsFilter: Item[] = [],
		tagsFilter: string[] = [],
		maxSlots: number = Infinity
	) {
		if (typeof max !== 'number') throw new Error("max must be a number");
		if (typeof maxSlots !== 'number') throw new Error("maxSlots must be a number");
		if (Number.isNaN(max)) throw new Error("max must be a valid number");
		if (max < 1) throw new Error("max must be a natural number");
		if (!Array.isArray(itemsFilter)) throw new Error("itemsFilter must be an Array");
		if (!Array.isArray(tagsFilter)) throw new Error("tagsFilter must be an Array");

		this.#itemInstances = [];
		this.#contentChangeCallback = contentChangeCallback;
		this.#max = Math.ceil(max);
		this.#maxSlots = Math.ceil(maxSlots);
		this.#itemsFilter = Array.from(itemsFilter);
		this.#tagsFilter = Array.from(tagsFilter);
	}

	clone(){
		const newI = new Inventory(
			this.#contentChangeCallback,
			this.#max,
			Array.from(this.#itemsFilter),
			Array.from(this.#tagsFilter),
			this.#maxSlots
		)
		if (!newI.addItems(this.getAllItemInstances())) console.warn('cannot clone item contents')
		return newI
	}

	copy(
		contentChangeCallback: (inst: ItemInstance)=>void = () => {},
		max: number = Infinity,
		itemsFilter: Item[] = [],
		tagsFilter: string[] = [],
		maxSlots: number = Infinity
	) {
		const inventory = new Inventory(contentChangeCallback, max, itemsFilter, tagsFilter, maxSlots);
		inventory.addItems(this.getAllItemInstances());
		return inventory;
	}

	getMax() {
		return this.#max;
	}

	getMaxSlots() {
		return this.#maxSlots;
	}

	getContentChangeCallback(){
		return this.#contentChangeCallback
	}

	hasInstance(item: ItemInstance) {
		const entry = this.#getInstance(item);
		if (entry) {
			return entry.amount > 0;
		}
		return false;
	}

	#getInstance(item: ItemInstance): ItemInstance | undefined {
		if (item instanceof ItemInstance) {
			return this.#itemInstances.find(entry => entry.isEqual(item));
		}
		throw new Error("item is not Item or ItemInstance");
	}

	getInstance(item: ItemInstance): ItemInstance {
		const instance = this.#getInstance(item);
		if (instance) return instance.clone();
		return new ItemInstance(item instanceof ItemInstance ? item.item : item, 0);
	}

	getAmount(item: ItemInstance): number {
		const inventoryEntry = this.#getInstance(item);
		if (inventoryEntry) {
			return inventoryEntry.amount;
		} else {
			return 0;
		}
	}

	getAllItemInstances(): ItemInstance[] {
		return this.#itemInstances.map(instance => instance.clone());
	}

	/**
	 * Used to add/subtract an item from inventory. Can either take a Item amount:number pair or an ItemInstance. Filters and restrictions apply. amount cannot go into negatives and must be integers.
	 */
	changeItem(item: ItemInstance): boolean {

		const itemInstanceSample = item;
		const baseAmount = itemInstanceSample.amount;

		if (!this.canChange(itemInstanceSample)) return false;

		// Item successfully changed
		let itemInstance = this.#getInstance(itemInstanceSample);
		if (!itemInstance) {
			itemInstance = itemInstanceSample.clone();
			this.#itemInstances.push(itemInstance);
		} else {
			itemInstance.amount += baseAmount;
		}

		if (itemInstance.amount === 0) this.#itemInstances.splice(this.#itemInstances.indexOf(itemInstance), 1);
		this.#contentChangeCallback(itemInstance);
		return true;
	}

	addItem(item: ItemInstance): boolean {
		return this.changeItem(item);
	}

	subtractItem(item: ItemInstance): boolean {
		const cItem = item.clone();
		cItem.amount *= -1;
		return this.changeItem(cItem);
	}

	/**
	 * Tries to change every item at once. if any item can't be changed then nothing gets changed and it returns false
	 */
	changeItems(items: ItemInstance[]): boolean {
		if (items.every(item => this.canChange(item))) {
			for (const itemInstance of items) {
				if (!this.changeItem(itemInstance)) throw new Error("Invariant broken: inventory may be unpredictably mutated");
			}
			return true;
		}
		return false;
	}

	/**
	 * Tries to add every item at once. if any item can't be added then nothing gets added and it returns false
	 */
	addItems(items: ItemInstance[]): boolean {
		return this.changeItems(items);
	}

	/**
	 * Tries to subtract every item at once. if any item can't be subtracted then nothing gets subtracted and it returns false
	 */
	subtractItems(items: readonly ItemInstance[]): boolean {
		return this.changeItems(items.map(v => new ItemInstance(v.item, -v.amount, v.metadata)));
	}

	/**
	 * Return weather a change is possible without actually changing the content of the inventory
	 */
	canChange(item: ItemInstance): boolean {
		const baseAmount = item.amount;
		const baseItem = item.item;

		if (!Number.isInteger(baseAmount)) return false;

		if (typeof baseAmount !== 'number' || !Number.isFinite(baseAmount) || Number.isNaN(baseAmount)) return false;

		if (this.#itemsFilter.length > 0 && !this.#itemsFilter.includes(baseItem)) return false;
		if (this.#tagsFilter.length > 0 && !this.#tagsFilter.some(tag => baseItem.tags.includes(tag))) return false;

		const existing = this.#getInstance(item);

		if (!existing) {
			if (this.#itemInstances.length + 1 > this.#maxSlots) return false;
			if (baseAmount > this.#max) return false;
		} else {
			if (baseAmount > 0 && existing.amount + baseAmount > this.#max) return false;
			if (baseAmount < 0 && Math.abs(baseAmount) > existing.amount) return false;
		}
		return true;
	}

	setContentChangeCallback(func: (inst: ItemInstance)=>void = ()=>{}) {
		if (typeof func !== 'function' && func !== null) throw new Error("func is not a function or null");
		this.#contentChangeCallback = func;
		return this;
	}
}




export class ItemInstance {
	static from(inst: ItemInstance):ItemInstance{
		return new ItemInstance(inst.item, inst.amount, inst.metadata)
	}

	static fromRef(ref: ItemInstanceSer, items:Item[]):ItemInstance{
		return new ItemInstance(getItemFromId(ref.id, items), ref.amount, ref.metadata)
	}

	static fromItem(item: Item, amount?: number): ItemInstance {
		return new ItemInstance(item, amount ?? 1)
	}

	readonly item: Item
	amount: number
	metadata: JSONValue
	constructor(item: Item, amount = 0, metadata: JSONValue = null) {
		this.item = item
		this.amount = amount
		this.metadata = structuredClone(metadata)
	}

	clone() {
		return new ItemInstance(this.item, this.amount, this.metadata)
	}

	serialize():ItemInstanceSer{
		return {id: this.item.id, amount: this.amount, metadata: this.metadata}
	}

	isEqual(itemInstance: ItemInstance, options = { ignoreAmount: true, ignoreMetadata: false }) {
		if (!(itemInstance instanceof ItemInstance)) throw new Error("itemInstance is not an ItemInstance")
		return (this.item.id === itemInstance.item.id && (options.ignoreMetadata || JSONEquals(this.metadata, itemInstance.metadata)) && (options.ignoreAmount || this.amount === itemInstance.amount))
	}
}




export class MachineInstance {
	readonly machine: Machine
	private stack: number
	private energy: number
	private input: Inventory
	private output: Inventory
	private work: number
	constructor(machine: Machine, stack: number = 1, energy: number = 0, work: number = 0, input: Inventory|undefined = undefined, output: Inventory|undefined = undefined) {
		this.machine = machine
		this.stack = stack
		this.energy = energy
		this.work = work
		this.input = input? input.clone() : new Inventory()
		this.output = output? output.clone() : new Inventory()
	}

	/**Returns a serialized snapshot of the state of a machine instance */
	serialize(): MachineInstanceSer{
		const serializeItInst = (inst: ItemInstance): ItemInstanceSer=>{
			return {
				id: inst.item.id,
				amount: inst.amount,
				metadata: inst.metadata
			}
		}
		return {
			machineId: this.machine.id,
			stack: this.stack,
			energy: this.energy,
			work: this.work,
			input: this.input.getAllItemInstances().map(serializeItInst),
			output: this.output.getAllItemInstances().map(serializeItInst),
		}
	}

	tick(deltaMS: number, recipes: readonly Recipe[], items: readonly Item[]) {
		const machineObject = this.machine
		const capableRecipes = recipes.filter(recipe=>machineObject.capabilities.includes(recipe.requiredProcess))

		const inputInventory = this.input
		const outputInventory = this.output

		
		const craft = (amount: number, recipe: Recipe)=>{
			const maxCraftable = maxCraftableCount(getRecipeInputs(recipe, items), inputInventory)
			const multiplier = Math.min(amount, maxCraftable)
			const itemsUsed = resolveCraftingCosts(recipe, inputInventory, items, {multiply:multiplier})
			if (!itemsUsed || !inputInventory.subtractItems(itemsUsed)) {
				throw new Error("Failed to subtract items from input inventory");
			}
			if (!outputInventory.changeItems(getRecipeOutputs(recipe, items).map(itemInst=>{itemInst.amount *= multiplier; return itemInst}))) {
				throw new Error("Failed to add items to output inventory");
			}
			return multiplier
		}

		const workingOn: Recipe[] = capableRecipes.filter(recipe=>Boolean(resolveCraftingCosts(recipe, inputInventory, items)))
		if (workingOn.length === 0) {
			return 'idle' as const
		}
		workingOn.sort((a,b)=>a.processTimeSeconds - b.processTimeSeconds)
	
		const energyPerWork: number = (()=>{
			return machineObject.fuelNeeds ?
			energyToNumber(machineObject.fuelNeeds.energy) :
			machineObject.energyNeeds ?
			energyToNumber(machineObject.energyNeeds.energy) * machineObject.energyNeeds.voltageTier :
			0
		})()

		const maxWorkAdded = Math.min(
			deltaMS/1000 * this.stack,
			Number.isFinite(this.energy/energyPerWork) ? this.energy/energyPerWork : Infinity
		)
		const {
			workDemand, // total demand, used and unfulfilled
			workDemands // total demand, for each individual recipe
		} = (()=>{ // invoked
			const workDemands: number[] = []
			let sum = 0
			for(const recipe of recipes){
				const maxCraftable = maxCraftableCount(getRecipeInputs(recipe, items), inputInventory)
				const seconds = recipe.processTimeSeconds
				workDemands.push(maxCraftable * seconds)
				sum += maxCraftable * seconds
			}
			return {
				workDemand: sum,
				workDemands
			}
		})()

		const workAdded = Math.min(relu(workDemand - this.work), maxWorkAdded)
		const lowEnergy = workDemand > this.energy / energyPerWork
		const energyNeeded = workAdded * energyPerWork
		this.energy -= energyNeeded
		this.work += workAdded
		
		for (const recipe of workingOn) {
			const sec = recipe.processTimeSeconds
			const amountOfCrafts = Math.floor(this.work / sec)
			const amountCrafted = craft(amountOfCrafts, recipe)			
			this.work -= sec * amountCrafted
		}


		// Return status from simulation, can be used for ui elements
		return {
			lowEnergy,
			progress: this.work / Math.min(...workDemands)
		}
	}
}

