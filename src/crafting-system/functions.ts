import { getDataMapToId } from "../game-data.js";
import { ItemEntry } from '../classes/item-entry.js';
import { ItemInstance } from '../classes/item-instance.js';
import { ResolvedRecipe } from "../classes/resolved-recipe.js";
import { Inventory } from '../classes/inventory.js';
import type { CraftingOptions, CustomRecipe, CustomRecipeSer, Input, InputSer, Item, Machine, Recipe } from "./types.js";


//Global variables
const {items, machines, recipes, extractors} = getDataMapToId()




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




export function capableRecipes(machine: Machine) {
	return recipes.values().toArray().filter(recipe=>machine.capabilities.includes(recipe.requiredProcess))
}




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
	recipe: CustomRecipe,
	inventory: Inventory,
	options: CraftingOptions = { multiply: 1 }
): ResolvedRecipe[] | false {
	if (!(inventory instanceof Inventory)) return false
	const inputs = applyCraftingOptions(options, recipe.inputs)

	const maxCraftable = maxCraftableCount(inputs, inventory)

	let multiplier = 1
	if (options.maximize) {
		multiplier = maxCraftable
	} else if (options.capAtMax) {
		multiplier = Math.min(maxCraftable, Math.max(1, Math.floor(options.multiply ?? 1)))
	} else {
		multiplier = Math.max(0, Math.floor(options.multiply ?? 1))
	}

	const output = recipe.outputs.map(ItemEntry.from)

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
			recipe.processTimeSeconds,
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
	recipe: CustomRecipe,
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
	recipe: CustomRecipe,
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




export function serializeInput(val:Input):InputSer {
	return {
		amount:val.amount,
		items:val.items.map(v=>v.serialize())
	}
}




export function deserializeInput(val:InputSer):Input {
	return {
		amount:val.amount,
		items:val.items.map(ItemInstance.fromSer)
	}
}




export function serializeCustomRecipe(val:CustomRecipe):CustomRecipeSer {
	return {
		inputs:val.inputs.map(serializeInput),
		outputs:val.outputs.map(v=>v.serialize()),
		processTimeSeconds:val.processTimeSeconds
	}
}




export function deserializeCustomRecipe(val:CustomRecipeSer):CustomRecipe {
	return {
		inputs:val.inputs.map(deserializeInput),
		outputs:val.outputs.map(ItemEntry.fromSer),
		processTimeSeconds:val.processTimeSeconds
	}
}




export function toCustomRecipe(rec:Recipe):CustomRecipe {
	return {
		inputs: getRecipeInputs(rec),
		outputs: getRecipeOutputs(rec),
		processTimeSeconds: rec.processTimeSeconds
	}
}


