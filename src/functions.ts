import { ItemEntry, ItemInstance, MachineInstance, ResolvedRecipe } from './classes.js';
import { Inventory } from './classes.js';
import type { Craftable, CraftingOptions, Input, Item, ItemInstanceSer, JSONValue, Machine, MachineInstanceSer, Recipe } from "./types.js";




export function relu(x: number) {
	return Math.max(x, 0)
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




/**
 * Get all recipes that crafts the provided item
 */
export function getRecipesProducing(craftable: Craftable, recipes: readonly Recipe[]) {
	return recipes.filter(recipe => {
		if (typeof recipe.outputs === "string") {
			return recipe.outputs === craftable.id
		}
		return recipe.outputs.some(output => output.id === craftable.id)
	})
}




/**
 * returns each recipe that consumes every provided item
 * @param consumed items the recipe must consume
 * @param recipes recipes checked
 * @param items all items
 */
export function getRecipesConsuming(consumed: ItemInstance|(readonly ItemInstance[]), recipes: readonly Recipe[], items: readonly Item[]) {
	const CONSUMED = Array.isArray(consumed) ? consumed : [consumed]
	return recipes.filter(recipe => 
		getRecipeInputs(recipe, items).every(input =>
			input.items.some(i =>
				CONSUMED.some(j => j.isEqual(i))
			)
		)
	)
}




/**
 * Returns every input with each item that is valid for that input of the recipe. think of it like this (item||item...)&&(item||item...)...
 */
export function getRecipeInputs(recipe: Recipe, items: readonly Item[]): Input[] {
	if (!Array.isArray(recipe.inputs)) return []
	return recipe.inputs.map(input => {
		const inputItems = new Set<Item>()
		for (const item of items) {
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




export function getItemFromId(id: string, items: readonly Item[]): Item {
	const item = items.find(item => item.id === id)
	if (!item) throw new Error("Could not find item from id:" + id)
	return item
}




export function getItemsFromTag(tag: string, items: readonly Item[]): Item[] {
	return items.filter(item => item.tags.includes(tag))
}




export function getRecipeFromId(id: string, recipes: readonly Recipe[]): Recipe {
	const item = recipes.find(item => item.id === id)
	if (!item) throw new Error("Could not find recipe from id: " + id)
	return item
}




export function getRecipeOutputs(recipe: Recipe, items: readonly Item[]): readonly ItemEntry[] {
	return recipe.outputs.map(output => 
		new ItemEntry(getItemFromId(output.id, items), null, output.amount === undefined ? 0 : output.amount)
	)
}




export function getAffordableRecipes(craftable: Craftable, inventory: Inventory, items: readonly Item[], recipes: readonly Recipe[]): Recipe[] {
	if (!(inventory instanceof Inventory)) throw new Error("inventory is not an Inventory")
	const allEntries = inventory.getAllItemInstances()
	const recipesProd = getRecipesProducing(craftable, recipes)
	if (recipesProd.length === 0) return []

	return recipesProd.filter(recipe => {
		return recipe.inputs.every(input => {
			let ingredientItems: Item[] = []
			if (input.tag) ingredientItems = getItemsFromTag(input.tag, items)
			if (input.id) ingredientItems.push(getItemFromId(input.id, items))
			if (ingredientItems.length === 0) throw new Error(`recipe:${recipe.id} has unknown inputs, could not find items for input: ${JSON.stringify(input)}`)
			return ingredientItems.some(item => {
				const matchingEntries = allEntries.filter(itemEntry => itemEntry.item === item)
				return matchingEntries.some(matchingEntry => matchingEntry.amount >= input.amount)
			})
		})
	})
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




export function capableRecipes(recipes: readonly Recipe[], machine: Machine) {
	return recipes.filter(recipe=>machine.capabilities.includes(recipe.requiredProcess))
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
	input: readonly ItemEntry[],
	recipes: readonly Recipe[], 
	items: readonly Item[]
) {
	let current: readonly ItemEntry[] = input
	const output: ItemEntry[] = []
	for (let i=0; i<line.length; i++) {
		const machine = line[i]!
		let recipe: Recipe|undefined
		for (let j=0; j<current.length; j++) {
			const c = current[j]!
			const rec = getRecipesConsuming(c, capableRecipes(recipes, machine), items)
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
		const out = getRecipeOutputs(recipe, items)
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
	line: readonly Machine[],
	recipes: readonly Recipe[], 
	items: readonly Item[]
) {
	const problems = []
	const superRecipes = []
	const firstM = line[0]
	if (!firstM) return {status: "empty_line"} as const
	const capable = capableRecipes(recipes, firstM)
	for (const recipe of capable) {
		const inputs = getRecipeInputs(recipe, items)
		const outputs = getRecipeOutputs(recipe, items)
		const result = runProcessingLine(line.toSpliced(0,1), outputs, recipes, items)
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
	items: readonly Item[],
	options: CraftingOptions = { multiply: 1 }
	): ResolvedRecipe[] | false {
	if (!(inventory instanceof Inventory)) return false
	const inputs = applyCraftingOptions(options, getRecipeInputs(recipe, items))

	const maxCraftable = maxCraftableCount(inputs, inventory)

	let multiplier = 1
	if (options.maximize) {
		multiplier = maxCraftable
	} else if (options.capAtMax) {
		multiplier = Math.min(maxCraftable, Math.max(1, Math.floor(options.multiply ?? 1)))
	} else {
		multiplier = Math.max(0, Math.floor(options.multiply ?? 1))
	}

	const output = getRecipeOutputs(recipe, items)

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
	items: readonly Item[],
	options?: CraftingOptions
	): ResolvedRecipe[] | false {
	const resolve = resolveCraftingCosts(recipe, inventory, items, options)
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
	items: readonly Item[],
	options: CraftingOptions = {multiply: 1}
	): ResolvedRecipe | false {
	if (options.multiply !== 1 || options.maximize) {
		console.warn("Invalid options", JSON.stringify(options))
		return false
	}
	const resolve = resolveCraftingCosts(recipe, inventory, items, options)
	if (!resolve) return false
	const res = resolve[0]
	if (res === undefined) return false
	if (!inventory.subtractItems(res.inputs)) throw new Error("Invariant broke");
	return res
}

/*
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Core functions END !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
*/




/**Saves the state of the main page to local storage */
export function save(items: ItemInstanceSer[], machines: MachineInstanceSer[]): void {
	localStorage.setItem('mainInventory', JSON.stringify(items))
	localStorage.setItem('machines', JSON.stringify(machines))
}




/**Loads the state of the main page from local storage */
export function load(): { items: readonly ItemInstanceSer[]; machines: readonly MachineInstanceSer[]}  {
	let items: JSONValue = localStorage.getItem('mainInventory')
	if (items) {
		items = JSON.parse(items)
	} else {
		items = []
	}
	let machines: JSONValue = localStorage.getItem('machines')
	if (machines) {
		machines = JSON.parse(machines)
	} else {
		machines = []
	}
	return {
		// @ts-ignore
		items,
		// @ts-ignore
		machines
	}
}




export async function fetchData() {
	async function fetchJSON(url: string) {
		return fetch(url).then(response => {
			if (!response.ok) {
				throw new Error("Network response was not ok" + response.statusText)

			}
			return response.json()
		})
	}

	function compile(items: unknown, machines: unknown, recipes: unknown, extraction: unknown) {

		if (!Array.isArray(items)) throw new Error("error")
		if (!Array.isArray(machines)) throw new Error("error")
		if (!Array.isArray(recipes)) throw new Error("error")
		if (!Array.isArray(extraction)) throw new Error("error")


		const limitKeysTo = (obj: any, keys: string[]) => {
			if (Object.keys(obj).some(key => !keys.includes(key))) throw new Error(`${obj.id} has invalid keys, object can only have these keys:${keys}`)
		}

		const includeKeys = (obj: any, keys: string[]) => {
			if (keys.some(key => !Object.keys(obj).includes(key))) throw new Error(`${obj.id} has invalid keys, object must include these keys:${keys}`)
		}

		items.forEach(item => {
			includeKeys(item, ['id', 'name', 'tags'])
		})

		machines.forEach(item => {
			includeKeys(item, ['id', 'name', 'capabilities', 'tier', "cost"])
		})
		machines.forEach(item => {
			limitKeysTo(item, ['id', 'name', 'capabilities', 'tier', "cost", "img", 'energyNeeds', 'fuelNeeds', "workerNeeds"])
		})

		recipes.forEach(item => {
			limitKeysTo(item, ['id', 'inputs', 'outputs', 'requiredProcess', 'requiredTier', 'processTimeSeconds'])
		})

		type Types = "string" | "number" | "boolean" | "array" | "object"
		const ct = (obj: any, type: Types|Types[], optional?: true) => {
			if (optional && obj === undefined) return
			const TYPE = [type].flat()
			const valid = TYPE.some(type => {
				if (type === 'array') {
					return Array.isArray(obj)
				}
				return typeof obj === type
			})
			if (!valid) throw new Error(`${obj} is not of type ${JSON.stringify(TYPE)}`)
		}

		for (const item of items) {
			ct(item.id, 'string')
			ct(item.name, 'string')
			ct(item.tags, 'array')
			ct(item.img, "string", true)
			item.tags.forEach((tag: any) => ct(tag, 'string'))
		}

		for (const machine of machines) {
			ct(machine.id, 'string')
			ct(machine.name, 'string')
			ct(machine.tier, 'number')
			ct(machine.cost, "array")
			for (const cost of machine.cost) {
				ct(cost.id, "string")
				ct(cost.amount, "number")
			}
			ct(machine.capabilities, 'array')
			machine.capabilities.forEach((item: any) => ct(item, 'string'))
			ct(machine.img, "string", true)
			if (machine.fuelNeeds) {
				ct(machine.fuelNeeds.tags, 'array')
				machine.fuelNeeds.tags.forEach((v: any) => ct(v, 'string'))
				ct(machine.fuelNeeds.energy, 'string')
			}
			if (machine.energyNeeds) {
				ct(machine.energyNeeds.voltageTier, 'number')
				ct(machine.energyNeeds.energy, 'string')
			}
		}

		for (const recipe of recipes) {
			ct(recipe.id, 'string')
			ct(recipe.requiredProcess, 'string')
			ct(recipe.requiredTier, 'number')
			ct(recipe.processTimeSeconds, 'number')
			ct(recipe.inputs, 'array')
			for(const input of recipe.inputs){
				limitKeysTo(input, ['id', 'tag', 'amount'])
				ct(input.id, 'string', true)
				ct(input.tag, 'string', true)
				ct(input.amount, 'number')
			}
			ct(recipe.outputs, "array")
			for (const output of recipe.outputs){
				limitKeysTo(output, ['id', 'tag', 'amount'])
				ct(output.id, 'string', true)
				ct(output.tag, 'string', true)
				ct(output.amount, 'number')
			}
		}


		const hasDuplicateIds = (array: any[]) => {
			const previousIds = new Set()
			const duplicates = new Set()
			for (const item of array) {
				if (previousIds.has(item.id)) duplicates.add(item.id)
				previousIds.add(item.id)
			}
			return duplicates.size === 0 ? false : duplicates
		}
		{
			const result = hasDuplicateIds(items.concat(machines))
			if (result) throw new Error(`Machines and Items has duplicate IDs, ${result}`)
		}
		{
			const result = hasDuplicateIds(recipes)
			if (result) throw new Error(`Recipes has duplicate IDs, ${result}`)
		}
		return { items, machines, recipes, extraction }
	}
	const items = await fetchJSON('src/game-data/items.json')
	const machines = await fetchJSON('src/game-data/machines.json')
	const recipes = await fetchJSON('src/game-data/recipes.json')
	const extraction = await fetchJSON('src/game-data/extraction.json')
	return compile(items, machines, recipes, extraction)
}

