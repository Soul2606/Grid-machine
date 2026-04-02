import { getDataMapToId } from "./game-data.js";
import { ItemEntry, ItemInstance, MachineInstance, ResolvedRecipe } from './classes.js';
import { Inventory } from './classes.js';
import type { CraftingOptions, Extractor, Input, Item, ItemInstanceSer, JSONValue, Machine, MachineInstanceSer, Recipe, RecipeInput } from "./types.js";


//Global variables
const {items, machines, recipes, extractors} = getDataMapToId()


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
 * returns each recipe that consumes every provided item
 * @param consumed items the recipe must consume
 * @param recipes recipes checked
 * @param items all items
 */
export function getRecipesConsuming(consumed: ItemInstance|(readonly ItemInstance[])) {
	const CONSUMED = Array.isArray(consumed) ? consumed : [consumed]
	return recipes.values().toArray().filter(recipe => 
		getRecipeInputs(recipe).every(input =>
			input.items.some(i =>
				CONSUMED.some(j => j.isEqual(i))
			)
		)
	)
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




/**
 * From a machine line and initial input, tries to rout the output from each machine to the input of the next machine.
 * 
 * If a machine down the line has multiple outputs it will try to route the first output that can be taken unambiguously by the current machine.
 * Unambiguously mans exactly one recipe is capable of taking the item.
 * The rest of the incoming items go directly to output.
 * 
 * If you get the "branching_inputs" status then that means the no input items can be taken unambiguously by the current machine. 
 * - incoming: the set of incoming items.
 * - step: where along the machine line we are.
 * 
 * If you get the "no_output" status then the selected recipe has no outputs. This is usually an issue with the game data and not the machine line. 
 * - recipe: the recipe with no output.
 * - step
 * @param line order matters, can contain duplicates
 * @param input in not mutated
 * @param recipes all
 * @param items all
 * @returns object with status: string
 */
export function runProcessingLine(
	line: readonly Machine[],
	input: readonly ItemEntry[]
) {
	let current: readonly ItemEntry[] = input
	const output: ItemEntry[] = []
	for (let i=0; i<line.length; i++) {
		const machine = line[i]!
		const capable = capableRecipes(machine)
		let recipe: Recipe|undefined
		for (let j=0; j<current.length; j++) {
			const c = current[j]!
			const rec = getRecipesConsuming(c).filter(r => capable.some(c => c.id === r.id))
			if (rec.length === 1) {
				recipe = rec[0]
				output.push(...current.toSpliced(j, 1))
				break
			}
		}	
		if (!recipe) {
			return {
				status:"branching_inputs",
				incoming:current,
				step:i
			} as const
		}
		const out = getRecipeOutputs(recipe)
		if (out.length === 0) {
			return {
				status:"no_output",
				recipe:recipe,
				step:i
			} as const
		}
		current = out
	}
	output.push(...current)
	return {
		status:"ok",
		output,
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
	line: readonly Machine[]
) {
	const problems = []
	const superRecipes = []
	const firstM = line[0]
	if (!firstM) return {status: "empty_line"} as const
	const capable = capableRecipes(firstM)
	for (const recipe of capable) {
		const inputs = getRecipeInputs(recipe)
		const outputs = getRecipeOutputs(recipe)
		const result = runProcessingLine(line.toSpliced(0,1), outputs)
		if (result.status !== "ok") {
			problems.push(result)
			continue
		}
		superRecipes.push({
			input: inputs,
			output: result.output,
		})
	}
	return {superRecipes, problems, status:"ok"} as const
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
 * Returns a resolved recipe,
 * or false if the recipe is not affordable.
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
	if (!inventory.subtractItems(resolve.flatMap(res => res.inputs))) throw new Error("Invariant broke");
	return resolve
}




/**
 * Similar to tryCraft except it does not allow batch crafting
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


