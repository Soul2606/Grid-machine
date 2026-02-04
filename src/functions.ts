import { ItemInstance } from './classes.js';
import { Inventory } from './classes.js';
import type { Craftable, CraftingOptions, Input, Item, ItemInstanceSer, JSONValue, MachineInstanceSer, Recipe } from "./types.js";




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
	parent: JSONValue | null
	path: readonly (string | number)[] 
}
export function walkJson<T=void>(obj: JSONValue, fnc: (args:WalkJsonArgs)=>T): T {
	const recurse = (
		current: JSONValue, 
		parent:  JSONValue              = null, 
		key:     string | number | null = null, 
		path:    Array<string | number> = []
	):T => {
		// Call user function with rich context
		const results = fnc({
			key,
			value: current,
			parent,
			path,
		})

		// Recurse into children if object/array
		if (Array.isArray(current)) {
			current.forEach((val, idx) => recurse(val, current, idx, [...path, idx]))
		} else if (typeof current === 'object') {
			for (const key in current) {
				const next = current[key]
				if (next === undefined) continue
				recurse(next, current, key, [...path, key])
			}
		}
		return results
	}

	return recurse(obj, null, null, [])
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




export function clamp(val: number, min: number, max: number) {
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
		return recipe.outputs.some(output => output.id === craftable.id)
	})
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
				new ItemInstance(item,1,input.meta)
			),
			amount: input.amount
		}
	})
}




export function getItemFromId(id: string, items: readonly Item[]): Item {
	const item = items.find(item => item.id === id)
	if (!item) throw new Error("Could not find item from id")
	return item
}




export function getItemsFromTag(tag: string, items: readonly Item[]): Item[] {
	return items.filter(item => item.tags.includes(tag))
}




export function getRecipeOutputs(recipe: Recipe, items: readonly Item[]): ItemInstance[] {
	return recipe.outputs.map(output => 
		new ItemInstance(getItemFromId(output.id, items), output.amount)
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
 * Returns the concrete ItemInstances required to craft,
 * or false if the recipe is not affordable.
 */
export function resolveCraftingCosts(
	recipe: Recipe,
	inventory: Inventory,
	items: readonly Item[],
	options: CraftingOptions = { multiply: 1 }
	): readonly ItemInstance[] | false {
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

	// Build chosen ItemInstances
	const chosenInstances = []
	for (const input of inputs) {
		let remaining = input.amount * multiplier
		for (const item of input.items) {
			if (remaining <= 0) break
			const available = inventory.getAmount(item)
			const take = Math.min(available, remaining)
			if (take > 0) {
				chosenInstances.push(new ItemInstance(item.item, take, item.metadata))
				remaining -= take
			}
		}
		if (remaining > 0) return false // not enough items
	}
	if (chosenInstances.some(used => !inventory.canChange(used, used.amount))) return false

	return chosenInstances
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
			includeKeys(item, ['id', 'name', 'capabilities', 'tier', 'requiresConfiguration'])
		})
		machines.forEach(item => {
			limitKeysTo(item, ['id', 'name', 'capabilities', 'tier', 'requiresConfiguration', 'energyNeeds', 'fuelNeeds'])
		})

		recipes.forEach(item => {
			limitKeysTo(item, ['id', 'inputs', 'outputs', 'requiredProcess', 'requiredTier', 'processTimeSeconds'])
		})

		const checkType = (obj: object, type: string) => {
			if (type === 'array') {
				if (!Array.isArray(obj)) throw new Error(`${obj} is not of an array`)
			}
			else if (typeof obj !== type) throw new Error(`${obj} is not of type ${type}`)
		}

		for (const item of items) {
			checkType(item.id, 'string')
			checkType(item.name, 'string')
			checkType(item.tags, 'array')
			item.tags.forEach((tag: any) => checkType(tag, 'string'))
		}

		for (const machine of machines) {
			checkType(machine.id, 'string')
			checkType(machine.name, 'string')
			checkType(machine.tier, 'number')
			checkType(machine.requiresConfiguration, 'boolean')
			checkType(machine.capabilities, 'array')
			machine.capabilities.forEach((item: any) => checkType(item, 'string'))
			if (machine.fuelNeeds) {
				checkType(machine.fuelNeeds.tags, 'array')
				machine.fuelNeeds.tags.forEach((v: any) => checkType(v, 'string'))
				checkType(machine.fuelNeeds.energy, 'string')
			}
			if (machine.energyNeeds) {
				checkType(machine.energyNeeds.voltageTier, 'number')
				checkType(machine.energyNeeds.energy, 'string')
			}
		}

		for (const recipe of recipes) {
			checkType(recipe.id, 'string')
			checkType(recipe.requiredProcess, 'string')
			checkType(recipe.requiredTier, 'number')
			checkType(recipe.processTimeSeconds, 'number')
			checkType(recipe.inputs, 'array')
			recipe.inputs.forEach((input: any) => {
				limitKeysTo(input, ['id', 'tag', 'amount'])
				if (input.id) checkType(input.id, 'string')
				if (input.tag) checkType(input.tag, 'string')
				checkType(input.amount, 'number')
			})
			checkType(recipe.outputs, 'array')
			recipe.outputs.forEach((output: any) => {
				limitKeysTo(output, ['id', 'tag', 'amount'])
				if (output.id) checkType(output.id, 'string')
				if (output.tag) checkType(output.tag, 'string')
				checkType(output.amount, 'number')
			})
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

		/*Some machines do not need to have their recipe set. All recipes used by those machines must me check to make sure they don't conflict.
		Recipes conflict if they take the same ingredient and produce different things: (a,b,c)→(a) and (a,b,c)→(b). They also conflict if one is a subset of another: (a)→(c) and (a,b)→(d).
		The outputs do not matter, only the input, even if they produce the exact same thing as long as the input conflict the entire recipe conflict. Conflict: (a)→(b) and (a)→(b). Don't conflict: (a)→(b) and (b)→(b).*/
		//Check if setA is a subset of setB
		const isSubset = (setA: any, setB: any) => [...setA].every(x => setB.has(x))

		for (const machine of machines) {
			if (machine.requiresConfiguration) continue
			const relevantRecipes = recipes.filter(recipe => machine.capabilities.includes(recipe.requiredProcess) && recipe.requiredTier <= machine.tier)
			const inputIdsSets = relevantRecipes.map(recipe => new Set(recipe.inputs.map((input: any) => input.itemId)))
			for (let i = 0; i < inputIdsSets.length; i++) {
				for (let j = i + 1; j < inputIdsSets.length; j++) {
					const setA = inputIdsSets[i]
					const setB = inputIdsSets[j]
					if (i === j) continue
					if (isSubset(setB, setA) || isSubset(setA, setB)) {
						throw new Error(`Conflicting recipes detected for machine ${machine.name}. Recipe ${relevantRecipes[i].id} and ${relevantRecipes[j].id} have subset/superset inputs`)
					}
				}
			}
		}
		return { items, machines, recipes, extraction }
	}
	const items = await fetchJSON('src/game-data/items.json')
	const machines = await fetchJSON('src/game-data/machines.json')
	const recipes = await fetchJSON('src/game-data/recipes.json')
	const extraction = await fetchJSON('src/game-data/extraction.json')
	return compile(items, machines, recipes, extraction)
}

