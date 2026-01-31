import { getItemFromId, JSONEquals, energyToNumber, maxCraftableCount, getRecipeInputs, resolveCraftingCosts, getRecipeOutputs, relu, distributeIntEvenly } from './functions.js';
import type { Item, ItemInstanceSer, JSONValue, Machine, MachineInstanceSer, Recipe } from './types.js';




/**
 * Class for managing data of item instances. inventory can be constructed and configured before compilation.
 */
export class Inventory {

	static hasInfiniteSharingLoo(inv:Inventory, checked = new Set<Inventory>()): boolean{
		if (checked.has(inv)) return true
		checked.add(inv)
		for (const i of inv.shared) {
			if (this.hasInfiniteSharingLoo(i, checked)) return true
		}
		return false
	}

	private itemInstances: ItemInstance[]; // !!!!Important!!!! The actual items in the inventory
	private readonly max: number;          // Max for each item, not amount in total
	private readonly maxSlots: number;     // Max amount of different items
	private readonly contentChangeSignal: Signal<ItemInstance>;
	readonly signal: SignalInterfaceT<ItemInstance, void>
	public shared: Inventory[]
	constructor(
		max: number = Infinity,
		maxSlots: number = Infinity
	) {
		if (typeof max !== 'number') throw new Error("max must be a number");
		if (typeof maxSlots !== 'number') throw new Error("maxSlots must be a number");
		if (Number.isNaN(max)) throw new Error("max must be a valid number");
		if (max < 1) throw new Error("max must be a natural number");

		this.itemInstances = [];
		this.contentChangeSignal = new Signal<ItemInstance>();
		this.signal = this.contentChangeSignal.createInterface(true)
		this.max = Math.ceil(max);
		this.maxSlots = Math.ceil(maxSlots);
		this.shared = []
	}

	/**
	 * Finds an instance of the item in !ONLY THIS! inventory. Use with caution, this returns direct references!
	 */
	private findInstance(item: ItemInstance): ItemInstance | undefined {
		return this.itemInstances.find(entry => entry.isEqual(item));
	}

	/**
	 * Try to change content, only amount and max filter apply, does not use shared inventories
	 */
	private changeItemDirect(item: ItemInstance, amount: number): boolean {
		const existing = this.findInstance(item);

		if (!existing) {
			if (this.itemInstances.length + 1 > this.maxSlots) return false;
			if (amount > this.max) return false;
			this.itemInstances.push(item.clone());
		} else {
			const nextAmount = existing.amount + amount;
			if (nextAmount < 0 || nextAmount > this.max) return false;
			existing.amount = nextAmount;
			if (existing.amount === 0) {
				this.itemInstances.splice(this.itemInstances.indexOf(existing), 1);
			}
		}
		this.contentChangeSignal.send(this.getReflection(item))
		return true;
	}

	private shareAllowed(){
		return this.max === Infinity && this.maxSlots === Infinity
	}

	// ====== Execution ======

		clear(){
		this.itemInstances = []
		return this
	}

	/**
	 * Used to add/subtract an item from inventory.
	 * @param item Item instance to be added to inventory
	 * @param amount The amount that will change
	 * @param dryRun If true then no item will be added but you will still get the success value
	 * @returns success
	 */
	changeItem(item: ItemInstance, amount: number, dryRun: boolean = false): boolean {
		if (!Number.isInteger(amount)) return false;
		if (this.shareAllowed() && amount < 0 && this.shared.length > 0) {
			const toRemove = -amount;

			// --- Phase 1: compute how much we can remove ---
			const localInst = this.findInstance(item);
			const localAvailable = localInst ? localInst.amount : 0;

			let remaining = toRemove;

			const sharedPlans: { inv: Inventory; take: number }[] = [];

			// Take from local first
			const takeLocal = Math.min(localAvailable, remaining);
			remaining -= takeLocal;

			// Then evenly from shared inventories
			if (remaining > 0 && this.shared.length > 0) {
				const candidates = this.shared.map(inv=>{
					const inst = inv.findInstance(item)
					return inst?inst.amount:0
				})

				const distribution = distributeIntEvenly(remaining, candidates)
				if (distribution.reduce((p,n)=>p+n,0) < remaining) return false
				distribution.forEach((take, i)=>{
					const inv = this.shared[i]!
					sharedPlans.push({inv, take})
				})
			}

			// --- Phase 2: apply mutations ---
			if (!dryRun) {
				// Apply local
				if (takeLocal > 0 && localInst) {
					if (!this.changeItemDirect(item, -takeLocal)) throw new Error("Invariant broke");
				}

				// Apply shared
				for (const plan of sharedPlans) {
					if (!plan.inv.subtractItem(item, plan.take)) throw new Error("Invariant broke");
				}
			}

			return true;
		}
		return this.changeItemDirect(item, amount)
	}

	addItem(item: ItemInstance, amount: number): boolean {
		return this.changeItem(item, amount);
	}

	subtractItem(item: ItemInstance, amount: number): boolean {
		return this.changeItem(item, -amount);
	}

	/**
	 * Tries to change every item at once. if any item can't be changed then nothing gets changed and it returns false
	 */
	changeItems(items: ItemInstance[]): boolean {
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
	addItems(items: ItemInstance[]): boolean {
		return this.changeItems(items);
	}

	/**
	 * Tries to subtract every item at once. if any item can't be subtracted then nothing gets subtracted and it returns false
	 */
	subtractItems(items: readonly ItemInstance[]): boolean {
		return this.changeItems(items.map(v => new ItemInstance(v.item, -v.amount, v.metadata)));
	}

	// ====== Queries ======

	getLength() {
		return this.itemInstances.length
	}

	getMax() {
		return this.max;
	}

	getMaxSlots() {
		return this.maxSlots;
	}

	hasInstance(item: ItemInstance) {
		return this.getReflection(item).amount > 0
	}

	/**
	 * Returns an item based on content in this and shared inventories, does not return direct reference
	 */
	getReflection(item: ItemInstance): ItemInstance {
		const instance = this.getAllItemInstances().find(v=>v.isEqual(item));
		if (instance) return instance.clone();
		return new ItemInstance(item.item, 0);
	}

	getAmount(item: ItemInstance): number {
		return this.getReflection(item).amount
	}

	/**
	 * Returns item instances based on content in this and shared inventories, does not return direct reference
	 */
	getAllItemInstances(): ItemInstance[] {
		return ItemInstance.squash(this.itemInstances.concat(...this.shared.flatMap(inv=>inv.itemInstances)));
	}

	/**
	 * Return weather a change is possible without actually changing the content of the inventory
	 */
	canChange(item: ItemInstance, amount: number): boolean {
		// For the sake of clarity
		return this.changeItem(item, amount, true)
	}

	capacityFor(item: ItemInstance): number{
		const existing = this.hasInstance(item)
		return !existing && this.maxSlots === this.itemInstances.length ?
		0 :
		this.max - this.getAmount(item)
	}


	clone(){
		const newI = new Inventory(
			this.max,
			this.maxSlots
		)
		if (!newI.addItems(this.getAllItemInstances())) console.warn('cannot clone item contents')
		return newI
	}

	/**
	 * Copies and overwrites content of provided inventory from this inventory
	 */
	copyContent(inv: Inventory) {
		inv.itemInstances = Array.from(this.itemInstances)
		return inv;
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

	/**
	 * Does not mutate provided values
	 */
	static squash(items: readonly ItemInstance[]){
		const squashed = new Map<string, ItemInstance>()
		for (const inst of items) {
			const f = squashed.get(inst.item.id)
			if (f) {
				f.amount += inst.amount
			} else {
				squashed.set(inst.item.id, ItemInstance.from(inst))
			}
		}
		return squashed.values().toArray()
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

	isEqual(itemInstance: ItemInstance) {
		if (!(itemInstance instanceof ItemInstance)) throw new Error("itemInstance is not an ItemInstance")
		return (
			this.item.id === itemInstance.item.id
			&&
			JSONEquals(this.metadata, itemInstance.metadata)
		)
	}
}




export class MachineInstance {
	//Public
	readonly machine: Machine
	readonly input: Inventory
	readonly output: Inventory
	//Private
	private readonly items
	private readonly recipes
	private stack: number
	private energy: number
	private work: number
	private readonly capableRecipes: Recipe[]
	constructor(machine: Machine, items: readonly Item[], recipes: readonly Recipe[], stack: number = 1, energy: number = 0, work: number = 0) {
		this.machine = machine
		this.items =   items
		this.recipes = recipes
		this.stack =   stack
		this.energy =  energy
		this.work =    work
		this.input =   new Inventory()
		this.output =  new Inventory()
		this.capableRecipes = this.recipes.filter(recipe=>this.machine.capabilities.includes(recipe.requiredProcess))
	}

	/**Returns a serialized snapshot of the state of a machine instance */
	serialize(): MachineInstanceSer{
		const serializeItInst = (inst: ItemInstance)=>{
			return inst.serialize()
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

	setStack(n: number){
		this.stack = n
	}

	getStack(){
		return this.stack
	}

	tick(deltaMS: number) {
		const machine = this.machine
		const input = this.input
		const output = this.output

		
		const craft = (amount: number, recipe: Recipe)=>{
			const maxCraftable = maxCraftableCount(getRecipeInputs(recipe, this.items), input)
			const multiplier = Math.min(amount, maxCraftable)
			const itemsUsed = resolveCraftingCosts(recipe, input, this.items, {multiply:multiplier})
			if (!itemsUsed || !input.subtractItems(itemsUsed)) {
				console.warn("Failed to subtract items from input inventory");
				return 0
			}
			if (!output.changeItems(getRecipeOutputs(recipe, this.items).map(itemInst=>{itemInst.amount *= multiplier; return itemInst}))) {
				console.warn("Failed to add items to output inventory");
				return 0
			}
			return multiplier
		}

		const workingOn: Recipe[] = this.capableRecipes.filter(recipe=>Boolean(resolveCraftingCosts(recipe, input, this.items)))
		if (workingOn.length === 0) {
			return 'idle' as const
		}
		workingOn.sort((a,b)=>a.processTimeSeconds - b.processTimeSeconds)
	
		const energyPerWork: number = (()=>{
			return machine.fuelNeeds ?
			energyToNumber(machine.fuelNeeds.energy) :
			machine.energyNeeds ?
			energyToNumber(machine.energyNeeds.energy) * machine.energyNeeds.voltageTier :
			0
		})()

		const maxWorkAdded = Math.min(
			deltaMS/1000 * this.stack,
			Number.isFinite(this.energy/energyPerWork) ? this.energy/energyPerWork : Infinity
		)
		const {
			workDemand,  // total demand, used and unfulfilled
			lowestDemand,
		} = (()=>{ // invoked
			let sum = 0
			let lowestDemand = Infinity
			for(const recipe of workingOn){
				const maxCraftable = maxCraftableCount(getRecipeInputs(recipe, this.items), input)
				const seconds = recipe.processTimeSeconds
				sum += maxCraftable * seconds
				if (maxCraftable > 0 && seconds < lowestDemand) lowestDemand = seconds
			}
			return {
				workDemand: sum,
				lowestDemand
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
			progress: this.work / lowestDemand
		}
	}

	addFuel(fuel: ItemInstance):"success" | "incapable" | "incompatible" | "no_energy_in_item"{
		const fuelNeeds = this.machine.fuelNeeds
		if (!fuelNeeds) return "incapable"
		if (!fuelNeeds.tags.some(tag=>fuel.item.tags.includes(tag))) return "incompatible"
		if (!fuel.item.energy) return "no_energy_in_item"
		this.energy += energyToNumber(fuel.item.energy) * fuel.amount
		return "success"
	}

	addPower(power: number, voltageTier: number): "success" | "incapable" | "overloaded"{
		const energyNeeds = this.machine.energyNeeds
		if (!energyNeeds) return "incapable"
		if (voltageTier > energyNeeds.voltageTier) return "overloaded"
		this.energy += power
		return "success"
	}
}



type SignalInterfaceT<P, R> = {
	subscribe: (fnc: (param: P) => R)=> () => boolean
	once: (fnc: (param: P) => R)=> () => boolean
	unsubscribe: (fnc: (param: P) => R)=> boolean
	clear?: ()=> void
}

export class Signal<P = unknown, R = void> {
	private listeners = new Set<(param: P) => R>()
	private onceListener = new Set<(param: P) => R>()

	subscribe(fnc: (param: P) => R) {
		this.listeners.add(fnc)
		return () => this.listeners.delete(fnc)
	}

	once(fnc: (param: P) => R) {
		this.onceListener.add(fnc)
		return () => this.onceListener.delete(fnc)
	}

	unsubscribe(fnc: (param: P) => R): boolean {
		return this.listeners.delete(fnc) || this.onceListener.delete(fnc)
	}

	clear(){
		this.listeners.clear()
		this.onceListener.clear()
	}

	send(param: P): R[] {
		const results: R[] = []
		this.listeners.forEach(f => results.push(f(param)))
		this.onceListener.forEach(f => results.push(f(param)))
		this.onceListener.clear()
		return results
	}

	createInterface(includeClear: boolean): SignalInterfaceT<P, R> {
		const self = this

		const api: SignalInterfaceT<P, R> = {
			subscribe: fnc => self.subscribe(fnc),
			once: fnc => self.once(fnc),
			unsubscribe: fnc => self.unsubscribe(fnc),
		}

		if (includeClear) {
			api.clear = () => self.clear()
		}

		return api
	}

}

