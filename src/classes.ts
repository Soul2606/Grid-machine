import { getItemFromId, JSONEquals, energyToNumber, maxCraftableCount, getRecipeInputs, getRecipeOutputs, relu, distributeIntEvenly, clamp, getRecipeFromId } from './functions.js';
import type { CraftingOptions, Item, ItemInstanceSer, JSONValue, Machine, MachineInstanceSer, Output, Recipe, ResolvedRecipeSer, } from './types.js';




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

	private itemInstances: ItemEntry[]; // !!!!Important!!!! The actual items in the inventory
	private readonly max: number;          // Max for each item, not amount in total
	private readonly maxSlots: number;     // Max amount of different items
	private readonly contentChangeSignal: Signal<ItemEntry>;
	readonly signal: SignalInterfaceT<ItemEntry, void>
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
		this.contentChangeSignal = new Signal<ItemEntry>();
		this.signal = this.contentChangeSignal.createInterface(true)
		this.max = Math.ceil(max);
		this.maxSlots = Math.ceil(maxSlots);
		this.shared = []
	}

	/**
	 * Finds an instance of the item in !ONLY THIS! inventory. Use with caution, this returns direct references!
	 */
	private findInstance(item: ItemInstance) {
		return this.itemInstances.find(entry => entry.isEqual(item));
	}

	/**
	 * Try to change content, only amount and max filter apply, does not use shared inventories
	 */
	private changeItemDirect(item: ItemInstance, amount: number, dryRun = false): boolean {
		const existing = this.findInstance(item);

		if (!existing) {
			if (this.itemInstances.length + 1 > this.maxSlots) return false;
			if (amount > this.max) return false;
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
		return this.changeItemDirect(item, amount, dryRun)
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
	getReflection(item: ItemInstance): ItemEntry {
		const instance = this.getAllItemInstances().find(v=>v.isEqual(item));
		if (instance) return instance.clone();
		return ItemEntry.fromInst(item, 0);
	}

	getAmount(item: ItemInstance): number {
		return this.getReflection(item).amount
	}

	/**
	 * Returns item instances based on content in this and shared inventories, does not return direct reference
	 */
	getAllItemInstances(){
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
		this.itemInstances = inv.getAllItemInstances()
		return this
	}
}




export class ItemInstance {

	static from(inst: ItemInstance):ItemInstance{
		return new ItemInstance(inst.item, inst.metadata)
	}

	static fromRef(ref: ItemInstanceSer, items:readonly Item[]){
		const item = getItemFromId(ref.id, items)
		const meta = ref.metadata === undefined? null : ref.metadata
		return new ItemInstance(item, meta)
	}

	static fromItem(item: Item, amount?: number): ItemInstance {
		return new ItemInstance(item, amount ?? 1)
	}

	/**
	 * Does not mutate provided values
	 */
	static squash(items: readonly ItemEntry[]){
		const squashed = new Map<string, ItemEntry>()
		for (const inst of items) {
			const f = squashed.get(inst.item.id)
			if (f) {
				f.amount += inst.amount
			} else {
				squashed.set(inst.item.id, ItemEntry.from(inst))
			}
		}
		return squashed.values().toArray()
	}

	readonly item: Item
	metadata: JSONValue
	constructor(item: Item, metadata: JSONValue = null) {
		this.item = item
		this.metadata = structuredClone(metadata)
	}

	clone() {
		return new ItemInstance(this.item, this.metadata)
	}

	serialize():ItemInstanceSer{
		return {id: this.item.id, metadata: this.metadata}
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




export class ItemEntry extends ItemInstance {

	static from(ent: ItemEntry){
		return new ItemEntry(ent.item, structuredClone(ent.metadata), ent.amount)
	}

	static fromInst(inst: ItemInstance, amount: number){
		return new ItemEntry(inst.item, structuredClone(inst.metadata), amount)
	}

	static fromRef(ref: ItemInstanceSer, items:readonly Item[]){
		const item = getItemFromId(ref.id, items)
		const meta = ref.metadata === undefined? null : ref.metadata
		const amount = ref.amount === undefined ? 0 : ref.amount
		return new ItemEntry(item, meta, amount)
	}

	amount: number
	constructor(item: Item, metadata: JSONValue, amount: number) {
		super(item, metadata)
		this.amount = amount
	}

	clone(): ItemEntry {
		return new ItemEntry(this.item, this.metadata, this.amount)
	}

	serialize():ItemInstanceSer{
		return {id: this.item.id, metadata: this.metadata, amount: this.amount}
	}

	strictEquals(ent: ItemEntry){
		return this.isEqual(ent) && this.amount === ent.amount
	}
}




export class MachineInstance {
	//Public
	readonly machine: Machine
	readonly items
	readonly recipes
	readonly capableRecipes: Recipe[]
	//Private
	private stack: number
	private energy:  number
	private workers: number
	private work: number    // 1 work equals 1 second of processing
	private workingOn: {recipe: ResolvedRecipe, amount: number}[] // Queue system, first item is the one thats actually being worked on
	constructor(machine: Machine, items: readonly Item[], recipes: readonly Recipe[], stack: number = 1, energy: number = 0, work: number = 0, workers = 0) {
		this.machine = machine
		this.items =   items
		this.recipes = recipes
		this.stack =   stack
		this.energy =  energy
		this.work =    work
		this.capableRecipes = this.recipes.filter(recipe=>this.machine.capabilities.includes(recipe.requiredProcess))
		this.workingOn = []
		this.workers = workers
	}

	private craft(multiplier: number, recipe: Recipe) {
		const output = getRecipeOutputs(recipe, this.items)
		return output.map(ent=>{ent.amount *= multiplier; return ent})
	}

	/**Returns a serialized snapshot of the state of a machine instance. */
	serialize(): MachineInstanceSer{
		return {
			machineId: this.machine.id,
			stack: this.stack,
			energy: this.energy,
			workers: this.workers,
			work: this.work,
			workingOn: this.workingOn.map(wo => ({
				amount: wo.amount,
				recipe: wo.recipe.serialize()
			}))
		}
	}

	setStack(n: number){
		this.stack = n
	}

	getStack(){
		return this.stack
	}

	getEnergy(){
		return this.energy
	}

	craftableFromInventory(inv: Inventory, opt?: CraftingOptions){
		return this.capableRecipes.map(r => {
			return {
				amount: maxCraftableCount(getRecipeInputs(r, this.items), inv, opt),
				recipe: r
			}
		}).filter(r=>r.amount>0)
	}

	addWorkingOn(recipes: ResolvedRecipe[]){
		for (const recipe of recipes) {
			const existing = this.workingOn.find(wo => wo.recipe.equals(recipe))
			if (existing) {
				existing.amount ++
			} else {
				this.workingOn.push({recipe, amount:1})
			}
		}
		return this
	}

	refundWorkingOn(recipeId: string): ItemInstance[]|"id_not_found"{
		const existing = this.workingOn.find(wo => wo.recipe.id === recipeId)
		if (existing) {
			const consumed = existing.recipe.inputs.map(item => ItemEntry.fromInst(item, item.amount * existing.amount))
			existing.amount = 0
			this.workingOn = this.workingOn.filter(wo => wo.amount > 0) // prune
			return consumed
		}
		return "id_not_found"
	}

	/**Returns a multiplier based on workers per need. Accounts for if workers are not being needed. */
	workerMultiplier() {
		const workerNeeds = this.machine.workerNeeds
		if (!workerNeeds) return 1
		if (this.stack === 0) return 0
		const minimum = workerNeeds.minimum
		if (minimum === 0) return 1
		const minimumTotal = workerNeeds.minimum * this.stack
		if (this.workers < minimum) return 0 // Not enough for even a single machine
		const ratio = this.workers / minimumTotal
		const satisfy = clamp(ratio)     //Base speed based on ratio
		const overflow = ratio - satisfy //Overflow gives bonus speed at half efficiency
		return satisfy + overflow / 2
	}

	/**
	 * ====The main simulation function==== 
	 * @param deltaMS delta time in milliseconds
	 * @param manually if true: overwrites needs for workers(if needed)
	 * @returns status about this simulation tick
	 */
	tick(deltaMS: number, manually = false) {
		const machine = this.machine
		const workingOn = this.workingOn.map(wo =>({
			woQueue: wo,
			recipe: getRecipeFromId(wo.recipe.id, this.recipes)
		}))
		const energy = this.energy

		if (workingOn.length === 0) {
			return 'idle' as const
		}
		workingOn.sort((a,b)=>a.recipe.processTimeSeconds - b.recipe.processTimeSeconds)
	
		const energyPerWork: number = (()=>{
			return machine.fuelNeeds ?
			energyToNumber(machine.fuelNeeds.energy) :
			machine.energyNeeds ?
			energyToNumber(machine.energyNeeds.energy) * machine.energyNeeds.voltageTier :
			0
		})()

		const deltaS = deltaMS/1000
		const maxWorkAdded = Math.min(
			manually ? deltaS : deltaS * this.stack * this.workerMultiplier(),
			Number.isFinite(energy/energyPerWork) ? energy/energyPerWork : Infinity
		)
		
		const	workDemand = workingOn.reduce((prev, val)=>prev + val.woQueue.amount * val.recipe.processTimeSeconds, 0) // total demand, used and unfulfilled
		const lowestDemand = Math.min(...workingOn.map(w => w.recipe.processTimeSeconds))

		

		const workAdded = Math.min(relu(workDemand - this.work), maxWorkAdded)
		const lowEnergy = workDemand > energy / energyPerWork
		const energyNeeded = workAdded * energyPerWork
		this.energy -= energyNeeded
		this.work += workAdded
		
		const crafted: ItemEntry[] = []
		for (const wo of workingOn) {
			const sec = wo.recipe.processTimeSeconds
			const amountOfCrafts = Math.min(wo.woQueue.amount, Math.floor(this.work / sec))
			crafted.push(...this.craft(amountOfCrafts, wo.recipe))
			wo.woQueue.amount -= amountOfCrafts
			this.work -= sec * amountOfCrafts
		}
		this.workingOn = this.workingOn.filter(w => w.amount > 0) // Prune


		// Return status from simulation, can be used for ui elements
		return {
			lowEnergy,
			progress: this.work / lowestDemand,
			crafted
		}
	}

	addFuel(fuel: ItemEntry):"success" | "incapable" | "incompatible" | "no_energy_in_item"{
		const fuelNeeds = this.machine.fuelNeeds
		if (!fuelNeeds) return "incapable"
		if (this.energy === null) return "incapable"
		if (!fuelNeeds.tags.some(tag=>fuel.item.tags.includes(tag))) return "incompatible"
		if (!fuel.item.energy) return "no_energy_in_item"
		this.energy += energyToNumber(fuel.item.energy) * fuel.amount
		return "success"
	}

	addPower(power: number, voltageTier: number): "success" | "incapable" | "overloaded"{
		const energyNeeds = this.machine.energyNeeds
		if (!energyNeeds) return "incapable"
		if (this.energy === null) return "incapable"
		if (voltageTier > energyNeeds.voltageTier) return "overloaded"
		this.energy += power
		return "success"
	}

	changeWorker(workers:number){
		const need = this.machine.workerNeeds
		if (!need) return "incapable"
		if (this.workers + workers > need.maximum) return "too_many"
		if (this.workers + workers < 0) return "too_low"
		this.workers += workers
		return "success"
	}

	getWorkers(){
		return this.workers
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




/**
 * A fully resolved, irreversible execution of a single recipe.
 *
 * - Inputs and outputs are fixed and exact.
 * - Cannot be reversed back into its source recipe.
 * - id: is the id from the recipe that was resolved 
 *
 * This is the authoritative result produced by recipe resolution.
 */
export class ResolvedRecipe {
	readonly id: string
	readonly inputs: readonly ItemEntry[]
	readonly output: Output
	constructor(
		id:string,
		inputs: readonly ItemEntry[],
		output: Output
	){
		this.id = id
		this.inputs = inputs
		this.output = output
	}

	serialize():ResolvedRecipeSer{
		return {
			id: this.id,
			inputs: this.inputs.map(ent => ent.serialize()),
			output: this.output.map(ent => ent.serialize())
		}
	}

	equals(rr: ResolvedRecipe){
		return this.id === rr.id && 
		this.inputs.length == rr.inputs.length &&
		this.inputs.every(inp =>
			rr.inputs.some(i=>inp.strictEquals(i))
		) && 
		this.output.every(out =>
			rr.output.some(i=>out.strictEquals(i))
		)
	}
}

