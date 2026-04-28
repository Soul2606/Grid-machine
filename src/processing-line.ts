import { create, get, getRecipeOutputs, parseProcessingLine, removeAllChildren } from "./functions.js";
import * as game from "./engine.js";
import { getDataMapToId } from "./game-data.js";
import { createItemCell } from "./ui-components.js";
import type { CustomRecipe, Input, Item, Machine, Recipe } from "./types.js";
import { MachineInstance, type ItemEntry } from "./classes.js";

game.load()

get("back").addEventListener("click", () => {
	game.save()
	localStorage.setItem("load", "true")
	window.location.href = "index.html"
})

const select = get<HTMLDialogElement>("select")
const line = get("line")
type Id = string
var lineData:Id[] = []



const {machines} = getDataMapToId()
const macList = get("machines")
for (const [id, machine] of machines) {
	const img = create("img")
	img.src = machine.img
	img.onclick = () => {
		lineData.push(id)
		refresh()
	}
	macList.append(img)
}




get("close").addEventListener("click", () => {
	select.close()
})




get("add").addEventListener("click", () => {
	select.showModal()
})




let compiledRecipes:undefined|{
	inputs:readonly Input[]
	outputs:readonly ItemEntry[]
	time:number
}[]

let lineStats:undefined|{
	powerNeed:number,
}

function refresh() {
	removeAllChildren(line)

	const machineLine:{
		machine:Machine,
		stack:number
	}[] = []

	for (const id of lineData) {
		const mac = machines.get(id)
		if (!mac) continue
		machineLine.push({
			machine:mac,
			stack:1
		})
	}

	const inputs = get("inputs")
	const outputs = get("final-outputs")
	
	removeAllChildren(inputs)
	removeAllChildren(outputs)

	// This somehow works. I have some regrets on the crafting system but it is too late now ):
	const results = parseProcessingLine(lineData.map(id => ({
		machine:machines.get(id)!,
		stack:1
	})))

	if (results.status === "empty_line") {
		console.log("empty line");
		return
	}

	if (results.status !== "ok") return

	console.log("problems", results.problems);
	console.log("superRecipes", results.superRecipes);

	for (let i = 0; i < machineLine.length; i++) {
		const mac = machineLine[i]!;
		const img = create("img")
		img.src = mac.machine.img
		img.style.gridRow = "1/" + String(results.superRecipes.length + 1)
		line.append(img)

		for (let j = 0; j < results.superRecipes.length; j++) {
			const history = results.superRecipes[j]!.history[i]
			if (!history) continue

			const outputsEl = create("div")
			outputsEl.style.gridRow = String(j+1) + "/" + String(j+2)

			for (const rec of history.recipes) {
				const outputs = getRecipeOutputs(rec)
				outputs.forEach(ent => ent.amount *= history.batchSize)
				for (const ent of outputs) {
					const cell = createItemCell(ent.item)
					cell.amountLabel.textContent = ent.amount.toString()
					outputsEl.append(cell.element)
				}
			}

			line.append(outputsEl)
		}
	}
	
	for (const {input, output, time, history} of results.superRecipes) {
		
		console.log("history", history);
		const recOut = create("div")
		outputs.append(recOut)
		for (const out of output) {
			const cell = createItemCell(out.item)
			cell.amountLabel.textContent = out.amount.toString()
			recOut.append(cell.element)
		}

		const recIn = create("div")
		const span = create("span")
		span.textContent = `time:${time}`
		recIn.append(span)
		inputs.append(recIn)
		for (const inp of input) {
			const inputEl = create("div")
			inputEl.textContent = inp.amount.toString()
			recIn.append(inputEl)
			for (const inst of inp.items) {
				const cell = createItemCell(inst.item)
				cell.amountLabel.textContent = ""
				inputEl.append(cell.element)
			}
		}
	}

	get("main").style.gridTemplateRows = "auto ".repeat(results.superRecipes.length)
	line.style.gridTemplateColumns = "auto ".repeat(lineData.length * 2)
	
	compiledRecipes = results.superRecipes.map(sr => ({
		inputs:sr.input,
		outputs:sr.output,
		time:sr.time
	}))
}



get("confirm").addEventListener("click", () => {
	if (!compiledRecipes || !lineStats) {
		console.log("Nothing to confirm");
		return
	}


	const customRecipes:CustomRecipe[] = compiledRecipes.map(cr => {
		return {
			inputs:cr.inputs,
			outputs:cr.outputs,
			processTimeSeconds: cr.time,
		} satisfies CustomRecipe
	})

	new MachineInstance(
		customRecipes,
		[],
		1,
		0,
		[],
		undefined,
		"Processing line"
	)
})



