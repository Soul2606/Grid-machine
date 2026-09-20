import { getData } from "../game-data.js";
import { get, removeAllChildren } from "../common/utils.js";
import type { ItemDef, MachineDef, RecipeDef } from "../game-data.js";
import * as Ui from "./ui-comonents.js";
import { getItemFromId, getRecipesProducing } from "../crafting-system/functions.js";
import { getSignals } from "../keyboard-events.js";


const info = get("info")
const infoTitle = get("info-title")
const infoDesc = get("info-description")
const infoForm = get("info-formula")

const main = get("main")
const xButton = get("x-button")
const browser = get("browser")

const catalog = get("catalog")

export const hovering = {id:null as null|string}

for (const item of getData().items) {
	catalog.append(Ui.createItem(item))
}

xButton.addEventListener("click", e => {
	e.stopPropagation()
	main.style.display = "none"
})


window.addEventListener("mousemove", e => {
	info.style.left = e.x + "px"
	info.style.top = e.y + "px"
})


export function setInfo(def:ItemDef|MachineDef) {
	if ("formula" in def) {
		const item = def
		infoTitle.textContent = item.name
		infoDesc.textContent = item.description
		infoForm.replaceChildren(Ui.createChemicalFormula(item.formula))
	} else {
		const machine = def
		infoTitle.textContent = machine.name
		removeAllChildren(infoDesc)
		removeAllChildren(infoForm)
	}
}

function show(recipes:RecipeDef[]) {
	const capabilities = new Map<string, HTMLElement[]>()
	for (const rec of recipes) {
		if (capabilities.has(rec.requiredProcess)) {
			capabilities.get(rec.requiredProcess)!.push(Ui.createRecipeCard(rec.inputs, rec.outputs))
		} else {
			capabilities.set(rec.requiredProcess, [Ui.createRecipeCard(rec.inputs, rec.outputs)])
		}
	}

	if (capabilities.size === 0) return

	main.style.display = ""
	removeAllChildren(browser)

	for (const [capability, elements] of capabilities) {
		browser.append(Ui.createCapability(elements, capability))
	}
}

export function showRecipes(item:ItemDef) {
	show(getRecipesProducing({id:item.id, metadata:null}))
}

export function showUsage(item:ItemDef) {
	const recipes = getData().recipes.filter(rec => 
		rec.inputs.some(i =>
			"id" in i ? i.id === item.id : item.tags.includes(i.tag)
		)
	)
	show(recipes)
}

getSignals().keydown.subscribe(key => {
	if (key !== "KeyU") return
	const h = hovering.id
	if (h === null) return
	showUsage(getItemFromId(h))
})
