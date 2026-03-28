import { getData, getDataMapToId } from "./game-data.js";
import { getItemFromId, JSONEquals, energyToNumber, maxCraftableCount, getRecipeInputs, getRecipeOutputs, relu, distributeIntEvenly, clamp, getRecipeFromId } from './functions.js';
import type { CraftingOptions, Item, ItemInstanceSer, JSONValue, Machine, MachineInstanceSer, Recipe, ResolvedRecipeSer, } from './types.js';



//Global variables
const {items, machines, recipes, extractors} = getDataMapToId()



/**
 * Class for managing data of item instances. inventory can be constructed and configured before compilation.
 */
export class Inventory {
	private itemInstances: ItemEntry[]; // !!!!Important!!!! The actual items in the inventory
	private readonly max: number;          // Max for each item, not amount in total
	private readonly maxSlots: number;     // Max amount of different items
	private readonly contentChangeSignal: Signal<ItemEntry>;
	readonly signal: SignalInterface<ItemEntry, void>
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
	}

	/**
	 * Finds an instance of the item in !ONLY THIS! inventory. Use with caution, this returns direct references!
	 */
	private findInstance(item: ItemInstance) {
		return this.itemInstances.find(entry => entry.isEqual(item));
	}

	// ====== Execution ======

	clear(){
		this.itemInstances = []
		return this
	}

	/**
	 * Used to add/subtract an item from inventory.
	 * @param item Item instance to be added to inventory
	 * @param amount negative integers
	 * @param dryRun If true then no item will be added but you will still get the success value
	 * @returns success
	 */
	changeItem(item: ItemInstance, amount: number, dryRun: boolean = false): boolean {
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
		this.contentChangeSignal.send(this.getReflection(item))
		return true;
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
		return this.itemInstances.map(ent => ItemEntry.from(ent))
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

	static fromSer(ref: ItemInstanceSer){
		const item = getItemFromId(ref.id)
		const meta = ref.metadata === undefined? null : ref.metadata
		return new ItemInstance(item, meta)
	}

	static fromItem(item: Item) {
		return new ItemInstance(item)
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
		return {id: this.item.id, metadata: this.metadata, amount:1}
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

	static fromItem(item: Item, amount: number = 1) {
		return new ItemEntry(item, null, amount)
	}

	static fromSer(ref: ItemInstanceSer){
		const item = getItemFromId(ref.id)
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




type MIModules = {
	fuelNeed?:  {readonly need:   number, readonly tags:       readonly string[], energy: number}|undefined
	powerNeed?: {readonly need:   number, readonly voltageTier:number,            energy: number}|undefined,
	workerNeed?:{readonly minimum:number, readonly maximum:    number,            workers:number}|undefined,
}


type CustomRecipe = Omit<Recipe, "id">


export type MachineInstanceStatus = "idle" | {
	lowEnergy: boolean;
	progress: number;
	crafted: ItemEntry[];
}


export class MachineInstance {

	static fromMachine(machine: Machine, stack = 1){
		let modules:MIModules = {} 
		const fn = machine.fuelNeeds
		if (fn) {
			modules.fuelNeed = {need:energyToNumber(fn.energy), tags:fn.tags, energy:0}
		}
		const wn = machine.workerNeeds
		if (wn) {
			modules.workerNeed = {minimum:wn.minimum, maximum:wn.maximum, workers:0}
		}
		const pn = machine.energyNeeds
		if (pn) {
			modules.powerNeed = {need:energyToNumber(pn.energy), voltageTier:pn.voltageTier, energy:0}
		}
		return new MachineInstance(
			recipes.values().toArray().filter(recipe=>machine.capabilities.includes(recipe.requiredProcess)),
			machine.cost.map(inst => ItemEntry.fromSer(inst)),
			stack,
			0,
			[],
			modules
		)
	}

	static fromSer(ser:MachineInstanceSer){
		return new MachineInstance(
			ser.capableRecipes,
			ser.cost.map(ItemEntry.fromSer),
			ser.stack,
			ser.work,
			ser.workingOn.map(wo => ({
				amount:wo.amount,
				recipe:ResolvedRecipe.fromSer(wo.recipe)
			})),
			{
				fuelNeed:  structuredClone(ser.fuelNeed),
				powerNeed: structuredClone(ser.powerNeed),
				workerNeed:structuredClone(ser.workerNeed)
			}
		)
	}

	// ============== Properties ====================
	//Public
	readonly capableRecipes = new Map<string, Recipe>()
	readonly cost: readonly ItemEntry[]

	//Private
	private stack: number
	private work: number    // 1 work equals 1 second of processing
	private workingOn: {recipe: ResolvedRecipe, amount: number}[] // Queue system, first item is the one thats actually being worked on
	//Modules
	private readonly fuelNeed?:   {readonly need:number, readonly tags:readonly string[], energy:number}
	private readonly powerNeed?:  {readonly need:number, readonly voltageTier:number, energy:number}
	private readonly workerNeed?: {readonly minimum:number, readonly maximum:number, workers:number}

	// ============== Constructor ====================
	constructor(
		recipes: readonly CustomRecipe[],
		cost: readonly ItemEntry[],
		stack = 1,
		work = 0,
		workingOn: {recipe: ResolvedRecipe, amount: number}[] = [],
		modules:MIModules = {}
	) {
		recipes.forEach(rec =>{
			const uid = this.generateUID()
			this.capableRecipes.set(uid, {
				id: uid,
				inputs: rec.inputs,
				outputs: rec.outputs,
				requiredProcess: rec.requiredProcess,
				requiredTier: rec.requiredTier,
				processTimeSeconds: rec.processTimeSeconds
			})
		})
		this.cost = cost
		this.stack =   stack
		this.work =    work
		this.workingOn = workingOn
		if (modules.fuelNeed)   this.fuelNeed   = modules.fuelNeed
		if (modules.powerNeed) this.powerNeed   = modules.powerNeed
		if (modules.workerNeed) this.workerNeed = modules.workerNeed
	}

	// ============== Methods ====================

	private generateUID() {
		return `uid-${this.capableRecipes.size}`
	}

	private craft(multiplier: number, recipe: Recipe) {
		const output = getRecipeOutputs(recipe)
		return output.map(ent=>{ent.amount *= multiplier; return ent})
	}

	/**Returns a serialized snapshot of the state of a machine instance. */
	serialize():MachineInstanceSer{
		const workerNeed = structuredClone(this.workerNeed)
		const fuelNeed = structuredClone(this.fuelNeed)
		const powerNeed = structuredClone(this.powerNeed)
		return {
			capableRecipes: this.capableRecipes.values().toArray(),
			work: this.work,
			stack: this.stack,
			cost: this.cost.map(ent => ent.serialize()),
			workingOn: this.workingOn.map(wo => ({
				amount: wo.amount,
				recipe: wo.recipe.serialize()
			})),
			workerNeed:workerNeed,
			fuelNeed:fuelNeed,
			powerNeed:powerNeed,
		}
	}

	setStack(n: number){
		this.stack = n
	}

	getStack(){
		return this.stack
	}

	getFuelNeed(){
		return structuredClone(this.fuelNeed)
	}

	getWorkerNeed(){
		return structuredClone(this.workerNeed)
	}

	getPowerNeed(){
		return structuredClone(this.powerNeed)
	}

	addWorkingOn(recipes: ResolvedRecipe[]){
		for (const recipe of recipes) {
			if (!this.capableRecipes.has(recipe.id)) throw new Error("Id not recognized");
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
		const workerNeeds = this.workerNeed
		if (!workerNeeds) return 1
		if (this.stack === 0) return 0
		const minimum = workerNeeds.minimum
		if (minimum === 0) return 1
		const minimumTotal = workerNeeds.minimum * this.stack
		if (workerNeeds.workers < minimum) return 0 // Not enough for even a single machine
		const ratio = this.workerNeed.workers / minimumTotal
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
	tick(deltaMS: number, manually = false):MachineInstanceStatus {
		const workingOn = this.workingOn.map(wo =>({
			woQueue: wo,
			recipe: (()=>{
				const v = this.capableRecipes.get(wo.recipe.id)
				if (v === undefined) throw new Error("Invariant broke!");
				return v
			})()
		}))
		
		if (workingOn.length === 0) {
			return 'idle' as const
		}
		workingOn.sort((a,b)=>a.recipe.processTimeSeconds - b.recipe.processTimeSeconds)	

		const deltaS = deltaMS/1000
		const workTimeLabor = manually ? deltaS : deltaS * this.stack * this.workerMultiplier()
		const workFuel = this.fuelNeed ? this.fuelNeed.energy / this.fuelNeed.need : Infinity
		const workPower = this.powerNeed ? this.powerNeed.energy / this.powerNeed.need : Infinity

		const maxWorkAdded = Math.min(
			workTimeLabor, //Should be and is usually the limiting factor
			workFuel,
			workPower
		)
		
		const	totalWorkNeed = workingOn.reduce((prev, val)=>prev + val.woQueue.amount * val.recipe.processTimeSeconds, 0) // total demand, used and unfulfilled
		const lowestDemand = Math.min(...workingOn.map(w => w.recipe.processTimeSeconds)) //Infinity on empty queue is intended

		const workAdded = Math.min(relu(totalWorkNeed - this.work), maxWorkAdded)
		const lowEnergy = workTimeLabor > maxWorkAdded && totalWorkNeed > maxWorkAdded // time and labour was not the limiting factor
		this.work += workAdded
		if (this.fuelNeed) this.fuelNeed.energy -= workAdded * this.fuelNeed.need
		if (this.powerNeed) this.powerNeed.energy -= workAdded * this.powerNeed.need
		
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

	addFuel(fuel: ItemEntry){
		const fuelNeeds = this.fuelNeed
		if (!fuelNeeds) return "incapable"
		if (!fuelNeeds.tags.some(tag=>fuel.item.tags.includes(tag))) return "incompatible"
		if (!fuel.item.energy) return "no_energy_in_item"
		fuelNeeds.energy += energyToNumber(fuel.item.energy) * fuel.amount
		return "success"
	}

	addPower(power: number, voltageTier: number){
		const powerNeeds = this.powerNeed
		if (!powerNeeds) return "incapable"
		if (this.powerNeed === null) return "incapable"
		if (voltageTier > powerNeeds.voltageTier) return "overloaded"
		powerNeeds.energy += power
		return "success"
	}

	changeWorker(workers:number){
		const need = this.workerNeed
		if (!need) return "incapable"
		if (need.workers + workers > need.maximum * this.stack) return "too_many"
		if (need.workers + workers < 0) return "too_few"
		need.workers += workers
		return "success"
	}
}




export type SignalInterface<P, R> = {
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

	createInterface(includeClear: boolean): SignalInterface<P, R> {
		const self = this

		const api: SignalInterface<P, R> = {
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
 * - id: is the id from the recipe that was resolved 
 *
 * This is the authoritative result produced by recipe resolution.
 */
export class ResolvedRecipe {

	static fromSer(ser:ResolvedRecipeSer){
		return new ResolvedRecipe(
			ser.id,
			ser.inputs.map(ItemEntry.fromSer),
			ser.output.map(ItemEntry.fromSer)
		)
	}

	/**This is not an identifier of this class. Its the id of the recipe that this resolved from. Use the `equals` method instead. */
	readonly id: string
	readonly inputs: readonly ItemEntry[]
	readonly output: readonly ItemEntry[]
	constructor(
		id:string,
		inputs: readonly ItemEntry[],
		output: readonly ItemEntry[]
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

