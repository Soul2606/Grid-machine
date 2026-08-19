import { getRecipeOutputs, serializeCustomRecipe } from "../crafting-system/functions.js";
import { create, get, removeAllChildren } from "../common/utils.js";
import { parseProcessingLine } from "./LineHistory.js";
import * as game from "../engine.js";
import { getDataMapToId } from "../game-data.js";
import { createItemCell } from "../common/ui-components.js";
import type { CustomRecipe, Input, Machine } from "../crafting-system/types.js";
import type { MachineInstanceBlueprint } from "../common/types.js";
import type { JSONValue } from "../common/types.js";
import { ItemEntry } from '../classes/item-entry.js';

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

	// Constructing the ui from the data is tough without any framework
	const suRecipes = parseProcessingLine(lineData.map(id => ({
		machine:machines.get(id)!,
		stack:1
	})))

	if (suRecipes === "empty_line") {
		console.log("empty line");
		return
	}

	const height = suRecipes.length
	console.log("superRecipes", suRecipes);

	for (const [i, mac] of machineLine.entries()) {
		const img = create("img")
		img.src = mac.machine.img
		img.style.gridRow = "1/" + String(height + 1)
		line.append(img)

		for (let j = 0; j < suRecipes.length; j++) {
			const history = suRecipes[j]!.history[i]
			if (!history) continue

			const outputsEl = create("div")
			outputsEl.style.gridRow = String(j+1) + "/" + String(j+2)

			if (history.status !== "ok") {
				const stat = create("span")
				stat.textContent = "status:" + history.status

				outputsEl.append(stat)
			}

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
	
	for (const superRecipe of suRecipes) {

		const input = superRecipe.input
		const history = superRecipe.history

		const inpDiv = create("div")
		inputs.append(inpDiv)
		for (const inp of input) {
			const inputOptions = create("div")
			inputOptions.textContent = inp.amount.toString()
			inpDiv.append(inputOptions)
			for (const inst of inp.items) {
				const cell = createItemCell(inst.item)
				cell.amountLabel.textContent = ""
				inputOptions.append(cell.element)
			}
		}

		if (superRecipe.status !== "ok") {
			const errMessage = create("p")
			errMessage.textContent = superRecipe.status
			inpDiv.append(errMessage)
			continue
		}

		const {output, time} = superRecipe

		const span = create("span")
		span.textContent = `time:${time}`
		inpDiv.append(span)
		
		console.log("history", history);
		const recOut = create("div")
		outputs.append(recOut)
		for (const out of output) {
			const cell = createItemCell(out.item)
			cell.amountLabel.textContent = out.amount.toString()
			recOut.append(cell.element)
		}
	}

	get("main").style.gridTemplateRows = "auto ".repeat(height)
	line.style.gridTemplateColumns = "auto ".repeat(lineData.length * 2)
	
	compiledRecipes = suRecipes.flatMap(sr => {
		if (sr.status !== "ok") return []
		return [{
			inputs:sr.input,
			outputs:sr.output,
			time:sr.time
		}]
	})
}




get("confirm").addEventListener("click", () => {
	if (!compiledRecipes || !lineStats) {
		get("confirm-feedback").textContent = "Nothing to confirm"
		return
	}


	const customRecipes:CustomRecipe[] = compiledRecipes.map(cr => {
		return {
			inputs:cr.inputs,
			outputs:cr.outputs,
			processTimeSeconds: cr.time,
		} satisfies CustomRecipe
	})

	const blueprint:MachineInstanceBlueprint = {
		capabilities:customRecipes.map(serializeCustomRecipe),
		cost:ItemEntry.squash(lineData.flatMap(str => {
			const mac = machines.get(str)
			if (!mac) return []
			return mac.cost.map(ItemEntry.fromSer)
		})).map(ent => ent.serialize())
	}

	console.log("Final blueprint:", JSON.stringify(blueprint));
	get("confirm-feedback").textContent = "Successfully saved line to save file"

	const current:JSONValue = JSON.parse(localStorage.getItem("processingLines")??"[]")
	if (!Array.isArray(current)) {
		localStorage.setItem("processingLines",JSON.stringify([blueprint]))
		return
	}

	//@ts-ignore
	current.push(blueprint)

	localStorage.setItem("processingLines",JSON.stringify(current))
})



