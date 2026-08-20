import { deserializeCustomRecipe, serializeCustomRecipe, capableRecipes, toCustomRecipe } from '../crafting-system/functions.js';
import { energyToNumber } from "../common/utils.js";
import { clamp } from "../common/utils.js";
import { relu } from "../common/utils.js";
import type { Recipe, MachineSer, } from '../crafting-system/types.js';
import type { MachineDef } from '../game-data.js';
import { ResolvedRecipe } from "./resolved-recipe.js";
import { Item } from './item.js';
import { ItemEntry } from './item-entry.js';



type MIModules = {
	fuelNeed?:  {readonly need:   number, readonly tags:       readonly string[], energy: number}|undefined
	powerNeed?: {readonly need:   number, readonly voltageTier:number,            energy: number}|undefined,
	workerNeed?:{readonly minimum:number, readonly maximum:    number,            workers:number}|undefined,
}


export type MachineInstanceStatus = "idle" | {
	lowEnergy: boolean;
	progress: number;
	crafted: ItemEntry[];
}


export class Machine {

	static fromMachine(machine: MachineDef, stack = 1){
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
		const capable = capableRecipes(machine)
		return new Machine(
			capable.map(toCustomRecipe),
			machine.cost.map(inst => ItemEntry.fromSer(inst)),
			stack,
			0,
			[],
			modules,
			machine.name,
			machine.img,
			machine.id
		)
	}

	static fromSer(ser:MachineSer){
		return new Machine(
			ser.capableRecipes.map(deserializeCustomRecipe),
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
			},
			ser.name,
			ser.sprite,
			ser.machineId??undefined
		)
	}

	// ============== Properties ====================
	//Public
	readonly sprite:        string
	readonly name:          string
	readonly machineId:     string|undefined
	readonly capableRecipes = new Map<string, Recipe>()
	readonly cost:            readonly ItemEntry[]

	//Private
	private stack:     number
	private work:      number    // 1 work equals 1 second of processing
	private workingOn: {recipe: ResolvedRecipe, amount: number}[] // Queue system, first item is the one thats actually being worked on
	//Modules
	private readonly fuelNeed?:   {readonly need:number, readonly tags:readonly string[], energy:number}
	private readonly powerNeed?:  {readonly need:number, readonly voltageTier:number, energy:number}
	private readonly workerNeed?: {readonly minimum:number, readonly maximum:number, workers:number}

	// ============== Constructor ====================
	constructor(
		recipes:   readonly Recipe[],
		cost:      readonly ItemEntry[],
		stack      = 1,
		work       = 0,
		workingOn: {recipe: ResolvedRecipe, amount: number}[] = [],
		modules:   MIModules = {},
		name       = "",
		sprite     = "",
		machineId?:string
	) {
		recipes.forEach(rec =>{
			const uid = this.generateUID()
			this.capableRecipes.set(uid, rec)
		})
		this.name      = name
		this.sprite    = sprite
		this.machineId = machineId
		this.cost      = cost
		this.stack     =   stack
		this.work      =    work
		this.workingOn = workingOn
		if (modules.fuelNeed)   this.fuelNeed   = modules.fuelNeed
		if (modules.powerNeed) this.powerNeed   = modules.powerNeed
		if (modules.workerNeed) this.workerNeed = modules.workerNeed
	}

	// ============== Methods ====================

	private generateUID() {
		return `uid-${this.capableRecipes.size}`
	}

	private craft(multiplier: number, recipe: ResolvedRecipe) {
		
		const output = recipe.output
		return output.map(ent=>{const n = ItemEntry.from(ent); n.amount *= multiplier; return n})
	}

	/**Returns a serialized snapshot of the state of a machine instance. */
	serialize():MachineSer{
		const workerNeed = structuredClone(this.workerNeed)
		const fuelNeed = structuredClone(this.fuelNeed)
		const powerNeed = structuredClone(this.powerNeed)
		return {
			capableRecipes: this.capableRecipes.values().toArray().map(serializeCustomRecipe),
			work: this.work,
			stack: this.stack,
			cost: this.cost.map(ent => ent.serialize()),
			name: this.name,
			sprite: this.sprite,
			machineId: this.machineId??null,
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
			const existing = this.workingOn.find(wo => wo.recipe.equals(recipe))
			if (existing) {
				existing.amount ++
			} else {
				this.workingOn.push({recipe, amount:1})
			}
		}
		return this
	}

	refundWorkingOn(recipeId: ResolvedRecipe): Item[]|"not_found"{
		const existing = this.workingOn.find(wo => wo.recipe.equals(recipeId))
		if (existing) {
			const consumed = existing.recipe.inputs.map(item => ItemEntry.fromInst(item, item.amount * existing.amount))
			existing.amount = 0
			this.workingOn = this.workingOn.filter(wo => wo.amount > 0) // prune
			return consumed
		}
		return "not_found"
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
		const workingOn = this.workingOn
				
		if (workingOn.length === 0) {
			return 'idle' as const
		}
		workingOn.sort((a,b)=>a.recipe.time - b.recipe.time)	

		const deltaS = deltaMS/1000
		const workTimeLabor = manually ? deltaS : deltaS * this.stack * this.workerMultiplier()
		const workFuel = this.fuelNeed ? this.fuelNeed.energy / this.fuelNeed.need : Infinity
		const workPower = this.powerNeed ? this.powerNeed.energy / this.powerNeed.need : Infinity

		const maxWorkAdded = Math.min(
			workTimeLabor, //Should be and is usually the limiting factor
			workFuel,
			workPower
		)
		
		const	totalWorkNeed = workingOn.reduce((prev, val)=>prev + val.amount * val.recipe.time, 0) // total demand, used and unfulfilled
		const lowestDemand = Math.min(...workingOn.map(w => w.recipe.time)) //Infinity on empty queue is intended

		const workAdded = Math.min(relu(totalWorkNeed - this.work), maxWorkAdded)
		const lowEnergy = workTimeLabor > maxWorkAdded && totalWorkNeed > maxWorkAdded // time and labour was not the limiting factor
		this.work += workAdded
		if (this.fuelNeed) this.fuelNeed.energy -= workAdded * this.fuelNeed.need
		if (this.powerNeed) this.powerNeed.energy -= workAdded * this.powerNeed.need
		
		const crafted: ItemEntry[] = []
		for (const wo of workingOn) {
			const sec = wo.recipe.time
			const amountOfCrafts = Math.min(wo.amount, Math.floor(this.work / sec))
			crafted.push(...this.craft(amountOfCrafts, wo.recipe))
			wo.amount -= amountOfCrafts
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
