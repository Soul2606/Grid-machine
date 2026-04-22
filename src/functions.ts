import { getDataMapToId } from "./game-data.js";
import { ItemEntry, ItemInstance, MachineInstance, ResolvedRecipe } from './classes.js';
import { Inventory } from './classes.js';
import type { CraftingOptions, Extractor, Input, Item, ItemInstanceSer, JSONValue, Machine, MachineInstanceSer, Recipe, RecipeInput } from "./types.js";


//Global variables
const {items, machines, recipes, extractors} = getDataMapToId()




export function get<T extends HTMLElement = HTMLElement>(id:string) {
	const el = document.getElementById(id)
	if (!el) {
		throw new Error(`Cannot get element from id: ${id}`);
	}
	return el as T
}




export function getAll<T extends HTMLElement = HTMLElement>(className:string) {
	return Array.from(document.querySelectorAll<T>("."+className))
}




export function create<K extends keyof HTMLElementTagNameMap>(
	element: K,
	ns?: string
): HTMLElementTagNameMap[K] {
	if (ns) return document.createElementNS(ns, element) as HTMLElementTagNameMap[K]
	return document.createElement(element)
}




export function relu(x: number) {
	return Math.max(x, 0)
}




export function removeAllChildren(element:HTMLElement) {
	while (element.hasChildNodes()) {
		element.firstChild?.remove()
	}
}




/**
 * Distributes an integer evenly across an array without exceeding per-cell limits.
 * @param n integer to be distributed
 * @param limits limit of each cell that must not be exceeded
 */
export function distributeIntEvenly(n: number, limits: readonly number[]): number[] {
	if (!Number.isInteger(n) || n < 0) {
		throw new Error("n must be a non-negative integer");
	}

	const result = new Array(limits.length).fill(0);
	const remainingCaps = Array.from(limits);

	let remaining = Math.min(n, limits.reduce((a, b) => a + b, 0));

	while (remaining > 0) {
		let progressed = false;

		for (let i = 0; i < remainingCaps.length && remaining > 0; i++) {
			if (remainingCaps[i]! > 0) {
				result[i]++;
				remainingCaps[i]!--;
				remaining--;
				progressed = true;
			}
		}

		if (!progressed) break; // no capacity left anywhere
	}

	return result;
}




type WalkJsonArgs = { 
	key: string|number|null
	value: JSONValue 
	parent: null|Record<string,JSONValue>|JSONValue[]
	path: readonly (string | number)[] 
	isLeaf: false
	mutateValue: (newValue: JSONValue)=>void
	mutateKey: (newKey: string|number)=>void
} | { 
	key: string|number|null
	value: string|number|null|boolean
	parent: null|Record<string,JSONValue>|JSONValue[]
	path: readonly (string | number)[] 
	isLeaf: true
	mutateValue: (newValue: JSONValue)=>void
	mutateKey: (newKey: string|number)=>void
}
export function walkJson(obj: JSONValue, fnc: (args:WalkJsonArgs)=>void): void {
	type Parental = null|
	{readonly kind:"object", readonly key: string, readonly value: Record<string, JSONValue>}|
	{readonly kind:"array", readonly key: number, readonly value: JSONValue[]}

	const recurse = (
		current:JSONValue, 
		parent: Parental = null, 
		path:   Array<string | number> = []
	) => {
		const mutateValue = (newValue: JSONValue)=>{
			if (parent === null) return false
			if (parent.kind === "object"){
				parent.value[parent.key] = newValue
			} else {
				parent.value[parent.key] = newValue
			}
			return true
		}

		const mutateKey = (newKey: string|number)=>{
			if (parent === null) return false
			if (parent.kind === "object") {
				if (typeof newKey === "number") return false
				delete parent.value[parent.key]
			}
			if (parent.kind === "array") {
				if (typeof newKey === "string") return false
				parent.value.splice(parent.key, 1)
			}
			//@ts-ignore
			parent.value[newKey] = current
			return true
		}

		const isLeaf = current === null || typeof current === "number" || typeof current === "boolean" || typeof current === "string"
		fnc({
			key: parent ? parent.key : null,
			value: current as any,
			parent: parent ? parent.value : null,
			path,
			isLeaf,
			mutateValue,
			mutateKey
		})

		// Recurse into children if object/array
		if (Array.isArray(current)) {
			current.forEach((val, idx) => recurse(val, {value:current, key:idx, kind:"array"}, [...path, idx]))
		} else if (typeof current === 'object') {
			for (const key in current) {
				const next = current[key]
				if (next === undefined) continue
				recurse(next, {value:current, key, kind:"object"}, [...path, key])
			}
		}
	}

	return recurse(obj, null, [])
}




export function JSONEquals(obj1:JSONValue, obj2:JSONValue): boolean {
	function tupleToString(arr: readonly (string | number)[]): string {
		return arr
		.map(v => typeof v === "string" ? `'${v}'` : String(v))
		.join(",");
	}

	function setEquals(a: Set<string>, b: Set<string>): boolean {
		if (a.size !== b.size) return false;
		for (const v of a) {
			if (!b.has(v)) return false;
		}
		return true;
	}


	const pathMap = new Map<string, unknown>()
	const paths = new Set<string>()

	walkJson(obj1, ({value, path})=>{
		pathMap.set(tupleToString(path), value)
	})

	let mismatch = false
	walkJson(obj2, ({value, path})=>{
		paths.add(tupleToString(path))
		const value2 = pathMap.get(tupleToString(path))
		if (!pathMap.has(tupleToString(path))) mismatch = true
		if (value2 !== value && typeof value !== 'object' && typeof value2 !== 'object') mismatch = true
	})
	if (mismatch) return false

	return setEquals(new Set(pathMap.keys()), paths)
}




export function clamp(val: number, min: number = 0, max: number = 1) {
	const validate = (n: number) => {
		if (Number.isNaN(n)) throw new Error("type error. value must be a number")
		if (typeof n !== 'number') throw new Error("type error. value must be a number")
	}
	validate(val)
	validate(min)
	validate(max)
	return Math.max(min, Math.min(max, val))
}




export function clampByResource(delta:number, resource:number, need:number):{delta:number, used:number, satisfaction:number} {
	if (need <= 0) {
		return {delta, used:0, satisfaction:1}
	}
	const neg = delta < 0
	delta = Math.abs(delta)
	const final = Math.min(delta, delta / need * resource)
	return {
		delta:neg ? -final : final,
		used:final * need,
		satisfaction: final / delta
	}
}




/**
 * Get all recipes that crafts the provided item
 */
export function getRecipesProducing(craftable: ItemInstance) {
	return recipes.values().toArray().filter(recipe =>
		getRecipeOutputs(recipe).some(output => craftable.isEqual(output))
	)
}




/**
 * Returns each recipe that consumes exactly every provided item.
 * @param consumed the items the recipe must consume
 */
export function getRecipesConsuming(consumed: ItemInstance|(readonly ItemInstance[])) {
	const _consumed = Array.isArray(consumed) ? consumed : [consumed]
	return recipes.values().toArray().filter(recipe => {
		const inputs = getRecipeInputs(recipe)
		return inputs.every(input =>
			input.items.some(i =>
				_consumed.some(j => j.isEqual(i))
			)
			&& _consumed.length === inputs.length
		)
	})
}




/**
 * Returns every input with each item that is valid for that input of the recipe. think of it like this (item||item...)&&(item||item...)...
 */
export function getRecipeInputs(recipe: Recipe): Input[] {
	if (!Array.isArray(recipe.inputs)) return []
	return recipe.inputs.map(input => {
		const inputItems = new Set<Item>()
		for (const [id, item] of items) {
			if (item.id === input.id || (input.tag && item.tags.includes(input.tag))) {
				inputItems.add(item)
			}
		}
		return {
			items: Array.from(inputItems).map(item=>
				new ItemInstance(item, input.meta)
			),
			amount: input.amount
		}
	})
}




export function getItemFromId(id: string): Item {
	const item = items.get(id)
	if (!item) throw new Error("Could not find item from id:" + id)
	return item
}




export function getItemsFromTag(tag: string): Item[] {
	return items.values().toArray().filter(item => item.tags.includes(tag))
}




export function getRecipeFromId(id: string): Recipe {
	const item = recipes.get(id)
	if (!item) throw new Error("Could not find recipe from id: " + id)
	return item
}




export function getRecipeOutputs(recipe: Recipe): readonly ItemEntry[] {
	return recipe.outputs.map(output => 
		new ItemEntry(getItemFromId(output.id), null, output.amount === undefined ? 0 : output.amount)
	)
}




/**
 * Converts a string of energy in joules to a number
 */
export function energyToNumber(energyString: string): number {
	const prefix = energyString.slice(-2)
	const value = energyString.slice(0, -2)
	if ({ kJ: 1000, MJ: 1000000, GJ: 1000000000 }[prefix] === undefined || !Number.isFinite(Number(value))) return 0
	const multiplier = { kJ: 1000, MJ: 1000000, GJ: 1000000000 }[prefix]
	if (!multiplier) throw new Error("Invalid energy prefix, must be 'kJ, MJ or GJ'")
	return Number(value) * multiplier
}




export function capableRecipes(machine: Machine) {
	return recipes.values().toArray().filter(recipe=>machine.capabilities.includes(recipe.requiredProcess))
}




type LineHistory = Readonly<{
	incoming:readonly string[],
	consumed:readonly string[],
	unused:readonly string[],
	recipes:string,
	batchSize:number,
	recipeConflicts:readonly string[],
	tooComplex:boolean,
}>

type LineResult = Readonly<{
	status:"ok"
	history:readonly LineHistory[]
	output:readonly ItemEntry[]
	time:number
}>
|Readonly<{
	status:"ambiguous"
	history:readonly LineHistory[]
	step:number
	incoming:readonly ItemEntry[]
}>
|Readonly<{
	status:"no_recipe"
	history:readonly LineHistory[]
	step:number
	incoming:readonly ItemEntry[]
}>
|Readonly<{
	status:"no_output"
	history:readonly LineHistory[]
	step:number
	recipes:readonly Recipe[]
}>

/**
 * From a machine line and initial input, tries to rout the output from each machine to the input of the next machine.
 * 
 * If a machine down the line has multiple outputs it will try to route every item that can be taken unambiguously by the next machine.
 * Unambiguously mans that none of the items have branching paths they can go, and out of all the possible recipes none of them overlap.
 * The rest of the incoming items go directly to output.
 * 
 * If you get the "ambiguous" status then that means the items can not be taken unambiguously by the next machine. 
 * - incoming: the set of incoming items.
 * 
 * If you get "no_recipe" then no items can be used by the next machine.
 * 
 * If you get the "no_output" status then the selected recipe has no outputs. This is usually an issue with the game data and not the machine line. 
 * - recipe: the recipe with no output.
 * @param line order matters, can contain duplicates
 * @param input in not mutated
 */
export function runProcessingLine(
	line:readonly Readonly<{
		machine:Machine,
		stack:number
	}>[],
	input: readonly ItemEntry[]
):LineResult {

	let current: readonly ItemEntry[] = input
	const output: ItemEntry[] = []
	const history:LineHistory[] = []
	const times:number[] = []

	for (let i=0; i<line.length; i++) {
		const step = line[i]!
		const capable = capableRecipes(step.machine)

		let recipes:Recipe[] = []
		let batchSize = 0
		let ambiguous = false
		let tooComplex = false
		let conflicting:Recipe[] = []
		let unused:readonly ItemEntry[] = []
		let consumed:readonly ItemEntry[] = []

		for (const rec of capable) {
			const inv = new Inventory()
			inv.addItems(current)
			const resolves = tryCraft(rec, inv, {maximize:true})

			// This recipe cannot be crafted.
			if (!resolves) continue

			// If the inventory cannot satisfy all previous recipes consumption then the recipes are overlapping.
			if (!inv.clone().subtractItems(consumed)) {
				ambiguous = true
				conflicting.push(rec)
				continue
			}

			const sqa = ResolvedRecipe.squash(resolves)

			if (sqa.length !== 1) {
				// Recipe batch did not resolve cleanly, scattered batch crafting is unsupported.
				tooComplex = true
				continue
			}

			const resolve = sqa[0]!
			batchSize = resolve.amount
			recipes.push(rec)
			unused = inv.getAllItemInstances()
			output.push(...unused)
			consumed = resolve.value.inputs.map(ent =>
				ItemEntry.fromInst(ent, ent.amount * resolve.amount)
			)
		}

		history.push({
			incoming:current.map(i => `id:${i.item.id}, am:${i.amount}`),
			consumed:consumed.map(i => `id:${i.item.id}, am:${i.amount}`),
			unused: unused.map(i => `id:${i.item.id}, am:${i.amount}`),
			recipes: recipes.map(r => r.id).join(", "),
			batchSize,
			recipeConflicts:conflicting.map(r => r.id),
			tooComplex,
		})

		if (ambiguous) {
			return {
				status:"ambiguous",
				incoming:current,
				step:i,
				history
			} as const
		}

		if (!recipes) {
			return {
				status:"no_recipe",
				incoming:current,
				step:i,
				history
			} as const
		}

		const out = ItemEntry.squash(recipes.flatMap(recipe =>
			getRecipeOutputs(recipe)
		))
		out.forEach(ent =>
			ent.amount *= batchSize
		)
		if (out.length === 0) {
			return {
				status:"no_output",
				recipes:recipes,
				step:i,
				history
			} as const
		}

		times.push(...recipes.map(r =>
			r.processTimeSeconds / step.stack * batchSize
		))
		current = out
	}

	output.push(...current)

	return {
		status:"ok",
		output,
		time:Math.max(...times),
		history,
	} as const
}




/**
 * Tries to compile an entire machine line into a set of super recipes (recipe derived from a chain of recipes) based on the capabilities of the first machine in line.
 * @param line order matters, can contain duplicates
 * @param recipes all
 * @param items all
 * @returns 
 */
export function parseProcessingLine(
	line:readonly Readonly<{
		machine:Machine,
		stack:number
	}>[]
) {
	const problems = []
	const superRecipes:Readonly<{
		input: readonly Input[],
		output:readonly ItemEntry[],
		time:  number
	}>[] = []
	let history:(readonly LineHistory[])[] = []
	const first = line[0]
	if (!first) return {status: "empty_line"} as const
	const capable = capableRecipes(first.machine)
	for (const recipe of capable) {
		const inputs = getRecipeInputs(recipe)
		const firstInputs = inputs.map(i => ItemEntry.fromInst(i.items[0]!, i.amount))

		const results = runProcessingLine(line, firstInputs)
		history.push(results.history)
		if (results.status !== "ok") {
			problems.push(results)
			continue
		}

		superRecipes.push({
			input: inputs,
			output: ItemEntry.squash(results.output),
			time: results.time
		})
	}

	return {
		status:"ok",
		superRecipes,
		problems,
		history,
	} as const
}






/*
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Core functions !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
*/

/**
 * Idempotent!
 * Normalizes recipe inputs according to CraftingOptions
 */
function applyCraftingOptions(options:CraftingOptions, inputs: readonly Input[]): readonly Input[] {
	return inputs.map(input=>{
		
		// Apply whitelist filters
		const whitelisted = input.items.filter(itemInst =>{
			const item = itemInst.item
			return (!options.itemWhitelist || options.itemWhitelist.includes(item)) &&
			(!options.tagWhitelist || item.tags.some(tag => options.tagWhitelist?.includes(tag)))
		});
		
		// Apply priority ordering
		if (options.itemPriorityList) {
			whitelisted.sort((a, b) => {
				const ai = options.itemPriorityList!.indexOf(a.item);
				const bi = options.itemPriorityList!.indexOf(b.item);
				return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
			});
		} else if (options.tagPriorityList) {
			whitelisted.sort((a, b) => {
				const ai = a.item.tags.findIndex(tag => options.tagPriorityList!.includes(tag));
				const bi = b.item.tags.findIndex(tag => options.tagPriorityList!.includes(tag));
				return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
			});
		}
		
		return {items:whitelisted, amount:input.amount}
	})
}



/**
 * Computes the maximum number of times a recipe can be crafted
 * given an inventory and options.
 */
export function maxCraftableCount(inputs: readonly Input[], inventory: Inventory, options: CraftingOptions = {multiply:1}): number {
	if (!(inventory instanceof Inventory)) return 0
	const _inputs = applyCraftingOptions(options, inputs)
	if (!_inputs.length) return 0

	const counts = _inputs.map(input => {
		const totalAvailable = input.items.reduce((sum, item) => {
			return sum + inventory.getAmount(item)
		}, 0)

		return Math.floor(totalAvailable / input.amount)
	})

	const limitingReagent = Math.min(...counts)
	if (!Number.isInteger(limitingReagent)) return 0
	return limitingReagent
}



/**
 * Resolves a recipe against an inventory under given options.
 * 
 * Returns an array of resolved recipes, the reason for the array is for batch crafting, aka instead of giving: "ResolvedRecipe * 3" it gives "[ResolvedRecipe, ResolvedRecipe, ResolvedRecipe]". This is easy to rectify because Resolved recipes have an equality method.
 * 
 * Returns false if the recipe is not affordable.
 * 
 * Does not mutate any give value
 */
export function resolveCraftingCosts(
	recipe: Recipe,
	inventory: Inventory,
	options: CraftingOptions = { multiply: 1 }
): ResolvedRecipe[] | false {
	if (!(inventory instanceof Inventory)) return false
	const inputs = applyCraftingOptions(options, getRecipeInputs(recipe))

	const maxCraftable = maxCraftableCount(inputs, inventory)

	let multiplier = 1
	if (options.maximize) {
		multiplier = maxCraftable
	} else if (options.capAtMax) {
		multiplier = Math.min(maxCraftable, Math.max(1, Math.floor(options.multiply ?? 1)))
	} else {
		multiplier = Math.max(0, Math.floor(options.multiply ?? 1))
	}

	const output = getRecipeOutputs(recipe)

	// Simulated inventory
	const simInv = inventory.clone()

	// Build ResolvedRecipe
	const resolvedRecipes = []
	for (let i = 0; i < multiplier; i++) {
		// Build chosen ItemEntries
		const chosenInstances = []
		for (const input of inputs) {
			let remaining = input.amount
			// Try to satisfy remaining from pool of accepted items
			for (const item of input.items) {
				if (remaining <= 0) break
				const available = simInv.getAmount(item)
				const take = Math.min(available, remaining)
				if (take > 0) {
					chosenInstances.push(new ItemEntry(item.item, item.metadata, take))
					if (!simInv.subtractItem(item, take)) throw new Error("Invariant broke");
					remaining -= take
				}
			}
			if (remaining > 0) return false // not enough items
		}
		resolvedRecipes.push(new ResolvedRecipe(
			recipe.id,
			chosenInstances,
			output
		))
	}
	return resolvedRecipes
}




/**
 * Similar to resolveCraftingCosts but it actually executes the craft and mutates the provided inventory if craft is completely successful
 */
export function tryCraft(
	recipe: Recipe,
	inventory: Inventory,
	options?: CraftingOptions
	): ResolvedRecipe[] | false {
	const resolve = resolveCraftingCosts(recipe, inventory, options)
	if (!resolve) return resolve
	if (resolve.length === 0) return false
	if (!inventory.subtractItems(resolve.flatMap(res => res.inputs))) throw new Error("Invariant broke");
	return resolve
}




/**
 * Similar to tryCraft except it does not allow batch crafting.
 * 
 * If the options: maximize is true, or multiply is not one, then the craft will fail.
 */
export function trySingleCraft(
	recipe: Recipe,
	inventory: Inventory,
	options: CraftingOptions = {multiply: 1}
): ResolvedRecipe | false {
	if (options.multiply !== 1 || options.maximize) {
		console.warn("Invalid options", JSON.stringify(options))
		return false
	}
	const resolve = resolveCraftingCosts(recipe, inventory, options)
	if (!resolve) return false
	const res = resolve[0]
	if (res === undefined) return false
	if (!inventory.subtractItems(res.inputs)) throw new Error("Invariant broke");
	return res
}

/*
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Core functions END !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
*/




/**
 * returns an exponentially bigger number based on how big n is.
 * @param n which step.
 * @returns the value of the step
 */
export function stepExponential(max: number):number[] {
	
	//1 2 3 4 5 6 7 8 9 10 20 30...
	function expo1234(max: number) {
		const result: number[] = []
		let power = 0
		while (power < 1000) {
			const scale = 10 ** power
			for (let i = 1; i <= 9; i++) {
				const value = i * scale
				if (value >= max) {
					result.push(max)
					return result
				}
				result.push(value)
			}
			power++
		}
		throw new Error("Failed to resolve exponential")
	}

	//1 2 5 10 20 50 100...
	function expo125(max: number) {
		const result: number[] = []
		const bases = [1, 2, 5]
		let power = 0
		while (power < 1000) {
			const scale = 10 ** power
			for (const b of bases) {
				const value = b * scale
				if (value > max) {
					if (result[result.length - 1] !== max) {
						result.push(max)
					}
					return result
				}
				result.push(value)
			}
			power++
		}
		throw new Error("Failed to resolve exponential");
	}

	if (max <= 500) {
		return expo1234(max)
	} else {
		return expo125(max)
	}
}


