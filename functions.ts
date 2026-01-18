import { ItemInstance } from './classes';
import { Inventory } from './classes';
import type { Craftable, CraftingOptions, Input, Item, Recipe } from "./types";




export function relu(x: number) {
	return Math.max(x, 0)
}




type WalkJsonArgs = { 
	key: string|number|null
	value: unknown 
	parent: Record<string, unknown> | unknown[] | null
	path: readonly (string | number)[] 
	set: (newValue: unknown) => void 
	delete: () => void 
	isLeaf: boolean 
}
export function walkJson(obj: Record<string, any>, fnc: (args:WalkJsonArgs)=>void) {
	const recurse = (
		current: unknown, 
		parent:  Record<string, unknown> | unknown[] | null = null, 
		key:     string | number | null         = null, 
		path:    Array<string | number>         = []
	) => {
		// Provide a mutator
		const set = (newValue: unknown) => {
			if (parent !== null && key !== null) {
				if (Array.isArray(parent)) {
					parent[Number(key)] = newValue
				} else {
					parent[String(key)] = newValue
				}
			}
		}
		const del = () => {
			if (parent !== null && key !== null) {
				if (Array.isArray(parent)) {
					parent.splice(key as number, 1)
				} else {
					delete parent[key]
				}
			}
		}

		// Call user function with rich context
		fnc({
			key,
			value: current,
			parent,
			path,
			set,
			delete: del,
			isLeaf: typeof current !== 'object' || current === null
		})

		// Recurse into children if object/array
		if (Array.isArray(current)) {
			current.forEach((val, idx) => recurse(val, current, idx, [...path, idx]))
		} else if (current && typeof current === 'object') {
			for (const k in current) {
				const currentObject = current as Record<string, unknown>
				recurse(currentObject[k], currentObject, k, [...path, k])
			}
		}
	}

	recurse(obj, null, null, [])
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
		return { items: Array.from(inputItems), amount: input.amount }
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
	return recipe.outputs.flatMap(output => {
		return [
			output.id ? new ItemInstance(getItemFromId(output.id, items), output.amount) : [],
			output.tag ? getItemsFromTag(output.tag, items).map(item => new ItemInstance(item, output.amount)) : []
		].flat()
	})
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
		const whitelisted = input.items.filter(item =>
			(!options.itemWhitelist || options.itemWhitelist.includes(item)) &&
			(!options.tagWhitelist || item.tags.some(tag => options.tagWhitelist?.includes(tag)))
		);
		
		// Apply priority ordering
		if (options.itemPriorityList) {
			whitelisted.sort((a, b) => {
				const ai = options.itemPriorityList!.indexOf(a);
				const bi = options.itemPriorityList!.indexOf(b);
				return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
			});
		} else if (options.tagPriorityList) {
			whitelisted.sort((a, b) => {
				const ai = a.tags.findIndex(tag => options.tagPriorityList!.includes(tag));
				const bi = b.tags.findIndex(tag => options.tagPriorityList!.includes(tag));
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
			return sum + inventory.getAmount(ItemInstance.fromItem(item))
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
			const available = inventory.getAmount(ItemInstance.fromItem(item))
			const take = Math.min(available, remaining)
			if (take > 0) {
				chosenInstances.push(new ItemInstance(item, take))
				remaining -= take
			}
		}
		if (remaining > 0) return false // not enough items
	}
	if (chosenInstances.some(used => !inventory.canChange(used))) return false

	return chosenInstances
}

/*
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Core functions !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
*/




