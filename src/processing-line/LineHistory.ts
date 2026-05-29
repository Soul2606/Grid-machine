import { ItemEntry, Inventory, ResolvedRecipe } from "../classes.js";
import { capableRecipes, tryCraft, toCustomRecipe, getRecipeOutputs, getRecipeInputs } from "../functions.js";
import type { Recipe, Machine, Input } from "../types.js";

type LineHistory = Readonly<{
	incoming: readonly ItemEntry[];
	consumed: readonly ItemEntry[];
	unused: readonly ItemEntry[];
	recipes: Recipe[];
	batchSize: number;
	recipeConflicts: readonly Recipe[];
	tooComplex: boolean;
}>;
type LineResult = Readonly<{
	status: "ok";
	history: readonly LineHistory[];
	output: readonly ItemEntry[];
	time: number;
}> |
Readonly<{
	status: "ambiguous";
	history: readonly LineHistory[];
	step: number;
	incoming: readonly ItemEntry[];
}> |
Readonly<{
	status: "no_recipe";
	history: readonly LineHistory[];
	step: number;
	incoming: readonly ItemEntry[];
}> |
Readonly<{
	status: "no_output";
	history: readonly LineHistory[];
	step: number;
	recipes: readonly Recipe[];
}>;




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
	line: readonly Readonly<{
		machine: Machine;
		stack: number;
	}>[],
	input: readonly ItemEntry[]
): LineResult {

	let current: readonly ItemEntry[] = input;
	const output: ItemEntry[] = [];
	const history: LineHistory[] = [];
	const times: number[] = [];

	for (let i = 0; i < line.length; i++) {
		const step = line[i]!;
		const capable = capableRecipes(step.machine);

		let recipes: Recipe[] = [];
		let batchSize = 0;
		let ambiguous = false;
		let tooComplex = false;
		let conflicting: Recipe[] = [];
		let unused: readonly ItemEntry[] = [];
		let consumed: readonly ItemEntry[] = [];

		for (const rec of capable) {
			const inv = new Inventory();
			inv.addItems(current);
			const resolves = tryCraft(toCustomRecipe(rec), inv, { maximize: true });

			// This recipe cannot be crafted.
			if (!resolves) continue;

			// If the inventory cannot satisfy all previous recipes consumption then the recipes are overlapping.
			if (!inv.clone().subtractItems(consumed)) {
				ambiguous = true;
				conflicting.push(rec);
				continue;
			}

			const sqa = ResolvedRecipe.squash(resolves);

			if (sqa.length !== 1) {
				// Recipe batch did not resolve cleanly, scattered batch crafting is unsupported.
				tooComplex = true;
				continue;
			}

			const resolve = sqa[0]!;
			batchSize = resolve.amount;
			recipes.push(rec);
			unused = inv.getAllItemInstances();
			output.push(...unused);
			consumed = resolve.value.inputs.map(ent => ItemEntry.fromInst(ent, ent.amount * resolve.amount)
			);
		}

		history.push({
			incoming: current,
			consumed: consumed,
			unused: unused,
			recipes: recipes,
			batchSize,
			recipeConflicts: conflicting,
			tooComplex,
		});

		if (ambiguous) {
			return {
				status: "ambiguous",
				incoming: current,
				step: i,
				history
			} as const;
		}

		if (recipes.length === 0) {
			return {
				status: "no_recipe",
				incoming: current,
				step: i,
				history
			} as const;
		}

		const out = ItemEntry.squash(recipes.flatMap(recipe => getRecipeOutputs(recipe)
		));
		out.forEach(ent => ent.amount *= batchSize
		);
		if (out.length === 0) {
			return {
				status: "no_output",
				recipes: recipes,
				step: i,
				history
			} as const;
		}

		times.push(...recipes.map(r => r.processTimeSeconds / step.stack * batchSize
		));
		current = out;
	}

	output.push(...current);

	return {
		status: "ok",
		output,
		time: Math.max(...times),
		history,
	} as const;
}




/**
 * Tries to compile an entire machine line into a set of super recipes (recipe derived from a chain of recipes) based on the capabilities of the first machine in line.
 * @returns
 */
export function parseProcessingLine(
	line: readonly Readonly<{
		machine: Machine;
		stack: number;
	}>[],
	multipliers: (undefined | number)[] = []
) {

	type SuperRecipe = Readonly<{
		status: "ok";
		input: readonly Input[];
		output: readonly ItemEntry[];
		time: number;
		history: readonly LineHistory[];
	}> |
		Readonly<{
			status: "ambiguous" | "no_recipe" | "no_output";
			input: readonly Input[];
			history: readonly LineHistory[];
		}>;

	const problems = [];
	const superRecipes: SuperRecipe[] = [];
	const first = line[0];
	if (!first) return "empty_line";
	const capable = capableRecipes(first.machine);

	for (const [index, recipe] of capable.entries()) {
		const multiplier = Math.floor(Math.max(1, multipliers[index] ?? 1));
		const inputs = getRecipeInputs(recipe);
		const firstInputs = inputs.map(inst => ItemEntry.fromInst(inst.items[0]!, inst.amount * multiplier)
		);

		const results = runProcessingLine(line, firstInputs);

		if (results.status !== "ok") {
			superRecipes.push({
				status: results.status,
				input: inputs,
				history: results.history,
			});
			continue;
		}

		superRecipes.push({
			status: "ok",
			input: inputs,
			output: ItemEntry.squash(results.output),
			time: results.time,
			history: results.history,
		});
	}

	return superRecipes;
}
