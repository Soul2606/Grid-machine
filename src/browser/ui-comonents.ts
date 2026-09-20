import { getData } from "../game-data.js";
import type { ItemEntry } from "../classes/item-entry.js";
import { create } from "../common/utils.js";
import { getItemFromId } from "../crafting-system/functions.js";
import type { ItemDef, MachineDef, RecipeDef, RecipeInput } from "../game-data";
import { hovering, setInfo, showRecipes } from "./browser.js";

const {machines} = getData()


export function createItem(item:ItemDef, amount?:number) {
	const root = create("div")
	root.style.backgroundImage = item.img ? `url(${item.img})` : '';
	root.style.backgroundSize = "cover"
	root.style.width = "100px"
	root.style.height = "100px"

	if (amount !== undefined) {
		root.textContent = amount.toFixed(0)
	}

	root.addEventListener("mouseenter", e => {
		e.stopPropagation()
		setInfo(item)
		hovering.id = item.id
	})

	root.addEventListener("click", e => {
		e.stopPropagation()
		showRecipes(item)
	})
	
	root.addEventListener("mouseleave", e => {
		e.stopPropagation()
		if (hovering.id === item.id) hovering.id = null
	})

	return root
}

export function createMachine(def:MachineDef) {
	const root = create("div")
	root.style.backgroundImage = `url(${def.img})`
	root.style.backgroundSize = "cover"
	root.style.width = "100px"
	root.style.height = "100px"

	root.addEventListener("mouseenter", e => {
		e.stopPropagation()
		setInfo(def)
	})

	return root
}

export function createChemicalFormula(formula: string): HTMLElement {
  const container = document.createElement("span");

  const isNum = (x:any) => Number.isFinite(Number(x))

  let i = 0;
  while (i < formula.length) {
    const char = formula[i]??"";

    // If number → collect full number and wrap in <sub>
    if (isNum(char)) {
      let num = char;
      i++;

      while (i < formula.length && isNum(formula[i])) {
        num += formula[i];
        i++;
      }

      const sub = document.createElement("sub");
      sub.textContent = num;
      container.appendChild(sub);
      continue;
    }

    // Otherwise just append text
    container.appendChild(document.createTextNode(char));
    i++;
  }

  return container;
}

export function createRecipeCard(itemsIn:readonly RecipeInput[], itemsOut:readonly ItemEntry[]) {
	const root = document.createElement("div")
	root.className = "recipe-card"

	const info = document.createElement("span")
	info.className = "recipe-card-info"
	root.append(info)

	const input = document.createElement("div")
	input.className = "recipe-card-io"
	for (const item of itemsIn) {
		if ("id" in item) {
			input.append(createItem(getItemFromId(item.id), item.amount))
		} else {
			console.warn("tags are not implemented yet!")
		}
	}
	root.append(input)

	const arrow = document.createElement("img")
	arrow.src = "svg/arrow.svg"
	arrow.style.width = "64px"
	arrow.setAttribute("width", "64")
	arrow.setAttribute("height", "64")
	root.append(arrow)

	const output = document.createElement("div")
	output.className = "recipe-card-io"
	for (const item of itemsOut) {
		output.append(createItem(getItemFromId(item.id), item.amount))
	}
	root.append(output)

	return root
}

export function createCapability(recipes:HTMLElement[], capability:string) {
	const capable = machines.filter(m => 
		m.capabilities.includes(capability)
	)

	const root = create("div")
	root.className = "capability"

	const title = create("span")
	title.textContent = capability
	root.append(title)

	const list = create("div")
	list.className = "capability-list"
	root.append(list)
	for (const mac of capable) {
		list.append(createMachine(mac))
	}

	const rec = create("div")
	root.append(rec)
	for (const el of recipes) {
		rec.append(el)
	}

	return root
}