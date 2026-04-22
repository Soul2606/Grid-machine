import { create, get, parseProcessingLine, removeAllChildren } from "./functions.js";
import * as game from "./engine.js";
import { getDataMapToId } from "./game-data.js";
import { createItemCell } from "./ui-components.js";

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




function addMachine(id:string) {
	const mac = machines.get(id)
	if (!mac) return

	const img = create("img")
	img.className = "cell"
	img.src = mac.img
	line.append(img)

	const output = create("div")
	line.append(output)
	output.className = "cell"

	return output
}




function refresh() {
	removeAllChildren(line)
	const outEl:HTMLElement[] = []
	const invalid = new Set<string>()
	for (const id of lineData) {
		const r = addMachine(id)
		if (r === undefined) {
			invalid.add(id)
			console.warn("failed to add machine");
			continue
		}
		outEl.push(r)
	}

	lineData = lineData.filter(id => !invalid.has(id))

	// This somehow works. I have some regrets on the crafting system but it is too late now ):
	const results = parseProcessingLine(lineData.map(id => ({
		machine:machines.get(id)!,
		stack:1
	})))

	if (results.status === "empty_line") {
		console.log("empty line");
		
	} else if (results.status === "ok") {
		console.log(results.problems);
		console.log(results.superRecipes);
		console.log(results.history);
		
		
		const inputs = get("inputs")
		const outputs = get("final-outputs")

		removeAllChildren(inputs)
		removeAllChildren(outputs)
		for (const {input, output, time} of results.superRecipes) {
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
	}
}



