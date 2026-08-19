import { getData } from "../game-data.js"
import type { MachineInstance } from "../classes/machine-instance.js"
import { ItemEntry } from '../classes/item-entry.js'
import { ItemInstance } from '../classes/item-instance.js'
import { type Inventory } from '../classes/inventory.js'
import { ResolvedRecipe } from "../classes/resolved-recipe.js"
import { getItemFromId, getItemsFromTag, maxCraftableCount, resolveCraftingCosts } from "../crafting-system/functions.js"
import { stepExponential } from "../common/utils.js"
import { clamp } from "../common/utils.js"
import { removeAllChildren } from "../common/utils.js"
import type { CraftingOptions, Machine, Recipe } from "../crafting-system/types.js"
import { createItemCell } from "../common/ui-components.js"
import type { SignalInterface } from "../lib/events/signal.js";



//Global variables
const {items, machines, recipes, extractors} = getData()


export function createQuantitySlider() {
	const root = document.createElement("div")
	root.className = "item-amount-slider"

	const slider = document.createElement("input")
	slider.type = 'range'
	slider.className = "item-amount-slider-slider"
	root.append(slider)

	const p = document.createElement("p")
	p.className = "item-amount-slider-text text-border"
	root.append(p)

	type QuantitySliderCallback = ((value: number) => void) | null

	let endCallbackFunction: QuantitySliderCallback = null
	let inputCallbackFunction: QuantitySliderCallback = null
	let sliderDisabled = true

	// Make it follow the mouse without pressing
	document.addEventListener('mousemove', e => {
		if (root.style.display === 'none') return
		const rect = slider.getBoundingClientRect()

		// Map mouse X position to slider range
		const percent = (e.clientX - rect.left) / rect.width
		const clamped = Math.min(Math.max(percent, 0), 1)

		slider.value = String(Math.round(
			Number(slider.min) + (Number(slider.max) - Number(slider.min)) * clamped
		))
		if (inputCallbackFunction) inputCallbackFunction(Number(slider.value))
	})

	document.addEventListener('mouseup', () => {
		if (sliderDisabled) return
		sliderDisabled = true
		root.style.display = 'none'
		if (endCallbackFunction) endCallbackFunction(Number(slider.value))
	})

	const show = (x: number, y: number, text: string, length = 15) => {
		// position is relative to the window, not the page
		if (typeof length !== 'number' || Number.isNaN(length) || (!Number.isFinite(length))) throw new Error("length is not a valid number")
		slider.max = String(length)
		setText(text)
		sliderDisabled = false
		root.style.display = ''
		// Position near mouse 
		root.style.left = `${x}px`
		root.style.top = `${y}px`

		// Prevent clipping off screen
		const rect = root.getBoundingClientRect()
		if (rect.right > window.innerWidth) {
			root.style.left = `${window.innerWidth - rect.width}px`
		}
		if (rect.bottom > window.innerHeight) {
			root.style.top = `${window.innerHeight - rect.height}px`
		}
	}

	const setText = (text: string) => { p.textContent = text }

	const setEndCallback = (func: QuantitySliderCallback) => {
		endCallbackFunction = func
	}

	const setInputCallback = (func: QuantitySliderCallback) => {
		inputCallbackFunction = func
	}

	/**
	 * Preset for an exponential number selector. The event "onEnd" is called when the event "mouseUp" is called, so this functions should be called when you expect mouseLeft to be down.
	 * 
	 * Example: maxAmount = 10_000.
	 * Then slider range is: [1,5,10,50,100,200,500,1000,2000,5000,10_000]
	 * @param x X-position relative to the window
	 * @param y Y-position relative to the window
	 * @param maxAmount The hights value the slider can select.
	 * @param onEnd called when the slider is finished and the value is selected.
	 * @param onInput called when the slider changes with the current selected value.
	 */
	const setupExp = (
		x:number,
		y:number,
		maxAmount:number,
		onEnd:(amount:number)=>void = ()=>{},
		onInput:(amount:number)=>void = ()=>{}
	)=>{
		const candidates = stepExponential(maxAmount)
			
		const steps = candidates.length
		if (steps === 0) return
	
		const formatLabel = (idx: number) => `${candidates[idx]}/${maxAmount}`
	
		show(x, y, formatLabel(0), steps)
	
		const _onInput = (step: number) => {
			const index = Math.max(0, Math.min(steps - 1, step - 1))
			setText(formatLabel(index))
			const amount = candidates[index] ?? 0
			onInput(amount)
		}
	
		const _onEnd = (step: number) => {
			setInputCallback(null)
			setEndCallback(null)
			const index = Math.max(0, Math.min(steps - 1, step - 1))
			const amount = candidates[index] ?? 0
			onEnd(amount)
		}
		setInputCallback(_onInput)
		setEndCallback(_onEnd)
	}

	const methods = {
		show,
		setEndCallback,
		setInputCallback,
		setText,
		setup: setupExp,
	} as const
	return { element: root, methods } as const
}




export function createItemTagCell(tag:string) {

	const items = getItemsFromTag(tag)
	if (items.length === 0) return null

	let index = 0
	const cell = createItemCell(items[index]!)

	function next() {
		index = (index + 1) % items.length
		cell.setItem(items[index]!)
	}

	return {
		element:cell.element,
		getItem:cell.getItem,
		amountLabel:cell.amountLabel,
		next,
	} as const
}




export function createMachine(name:string, img:string) {
	console.log("name:", name, "img:", img);
	
	const cell = document.createElement('div')
	cell.className = 'machine'
	cell.textContent = name
	cell.style.backgroundImage = `url(${img})`

	const stack = document.createElement('p')
	stack.textContent = String(1)

	const setStack = (text: string|number) => {
		stack.textContent = String(text)
	}

	cell.appendChild(stack)

	const progressBar = document.createElement('div')
	progressBar.className = 'progress-bar'
	cell.appendChild(progressBar)

	const progressBarFill = document.createElement('div')
	progressBarFill.className = 'progress-bar-fill'

	const setProgress = (n: number) => {
		progressBarFill.style.width = String(clamp(n, 0, 100)) + '%'
		if (n > 100) {
			progressBarFill.classList.add('rainbow')
		} else {
			progressBarFill.classList.remove('rainbow')
		}
	}

	progressBar.appendChild(progressBarFill)

	const warning = document.createElement('div')
	warning.className = 'warning-icon'
	const noFuel = document.createElement('img')
	noFuel.src = 'img/Fuel-icon-red.png'
	noFuel.style.display = 'none'
	warning.appendChild(noFuel)
	const setWarning = (string: "" | "no_fuel") => {
		switch (string) {
			case 'no_fuel':
				noFuel.style.display = ''
				break
			default:
				noFuel.style.display = 'none'
				break
		}
	}
	cell.appendChild(warning)

	return { element: cell, setStack, setProgress, setWarning }
}




export function createMachineUI(
	pubSubTick?: SignalInterface<number, void>
) {

	/**
	 * Events called by the ui component
	 */
	let events = {
		onAssignWorker: () => { },
		onLayOffWorker: () => { },
		onStackUp: () => { },
		onEvent: () => { },
	}


	const root = document.createElement("div")

	const header = document.createElement("div")
	root.append(header)

	const pe = document.createElement("p")
	header.append(pe)

	const pw = document.createElement("p")
	header.append(pw)

	const stackUp = document.createElement("button")
	stackUp.textContent = "Stack up"
	stackUp.addEventListener("click", e => {
		events.onStackUp()
		events.onEvent()
	})
	header.append(stackUp)

	const assignWorker = document.createElement("button")
	assignWorker.textContent = "Assign worker"
	assignWorker.style.display = "none"
	assignWorker.addEventListener("click", e => {
		events.onAssignWorker()
		events.onEvent()
	})
	header.append(assignWorker)

	const layOffWorker = document.createElement("button")
	layOffWorker.textContent = "Lay off worker"
	layOffWorker.style.display = "none"
	layOffWorker.addEventListener("click", e => {
		events.onLayOffWorker()
		events.onEvent()
	})
	header.append(layOffWorker)

	const grid = document.createElement("div")
	root.append(grid)

	let subscribers: (() => number)[] = []
	pubSubTick?.subscribe(() => {
		subscribers.forEach(f => f())
	})

	const refresh = (machine: MachineInstance, availableResources: Inventory) => {
		refreshText(machine)

		grid.innerHTML = ""
		subscribers = []
		machine.capableRecipes.forEach(cr => {
			const options: CraftingOptions = {}

			const out = cr.outputs
			console.log("out: ", out.map(o=>o.item.id).join(","))

			const outFirst = out[0]
			if (outFirst === undefined) throw new Error("Recipe produces nothing.")

			const cell = createItemCell(outFirst.item)

			const getCount = () => {
				const count = maxCraftableCount(cr.inputs, availableResources, options)
				cell.amountLabel.textContent = String(count)
				return count
			}
			getCount()

			cell.element.addEventListener("click", e => {
				const resolve = resolveCraftingCosts(cr, availableResources, options)
				if (!resolve) return
				if (!availableResources.subtractItems(resolve.flatMap(res => res.inputs))) throw new Error("Invariant broke")
				machine.addWorkingOn(resolve)
			})
			grid.append(cell.element)

			subscribers.push(getCount)
		})
	}

	const refreshText = (machine: MachineInstance) => {
		const fNeed = machine.getFuelNeed()
		if (fNeed) {
			pe.textContent = `Energy: ${fNeed.energy}`
		} else {
			pe.textContent = ""
		}
		const wNeed = machine.getWorkerNeed()
		if (wNeed) {
			assignWorker.style.display = ""
			layOffWorker.style.display = ""
			pw.textContent = `Workers: ${wNeed.workers}/${wNeed.maximum}`
		} else {
			pw.textContent = ""
			assignWorker.style.display = "none"
			layOffWorker.style.display = "none"
		}
	}

	return { element: root, refresh, refreshText, events }
}




export function createProcessingLine() {
	const root = document.createElement("div")
	root.className = "processing-line"

	const addBtn = document.createElement("button")
	addBtn.className = "processing-line-button"
	addBtn.textContent = "+"
	root.append(addBtn)
	
	/**
	 * Mutate to use events
	 */
	const events = {
		add:()=>{},
		remove:(inst:MachineInstance)=>{},
		right:(inst:MachineInstance)=>{},
		left:(inst:MachineInstance)=>{},
	}
	
	addBtn.addEventListener("click", ()=>events.add())

	function setLine(mInst:readonly MachineInstance[]) {

		removeAllChildren(root)

		root.append(addBtn)
		for (const inst of mInst) {
			const cell = document.createElement("div")
			cell.className = "processing-line-cell"
			const removeBtn = document.createElement("button")
			cell.append(removeBtn)
			const rightBtn = document.createElement("button")
			cell.append(rightBtn)
			const leftBtn = document.createElement("button")
			cell.append(leftBtn)

			root.append(cell)

			removeBtn.addEventListener("click", ()=>events.remove(inst))
			rightBtn. addEventListener("click", ()=>events.right(inst))
			leftBtn.  addEventListener("click", ()=>events.left(inst))
		}
	}

	return {
		element:root,
		setLine,
		events,
	}
}




export function createRecipeCard() {
	type EventsValue = {
		readonly type:"tag"
		readonly value:string
	}|{
		readonly type:"item"
		readonly value:ItemInstance
	}
	const events = {
		onMouseEnter: null as null | ((value:EventsValue)=>void),
		onMouseLeave: null as null | ((value:EventsValue)=>void),
		onClick:      null as null | ((value:EventsValue)=>void)
	}
	const root = document.createElement("div")
	root.className = "recipe-card"

	const info = document.createElement("span")
	info.className = "recipe-card-info"
	root.append(info)

	const input = document.createElement("div")
	input.className = "recipe-card-io"
	root.append(input)

	const arrow = document.createElement("img")
	arrow.src = "svg/arrow.svg"
	arrow.style.width = "64px"
	arrow.setAttribute("width", "64")
	arrow.setAttribute("height", "64")
	root.append(arrow)

	const output = document.createElement("div")
	output.className = "recipe-card-io"
	root.append(output)

	function applyEvents(element:HTMLElement, value:EventsValue) {
		element.addEventListener("mouseenter", ()=>events.onMouseEnter?events.onMouseEnter(value):null)
		element.addEventListener("mouseleave", ()=>events.onMouseLeave?events.onMouseLeave(value):null)
		element.addEventListener("click",      ()=>events.onClick     ?events.onClick(value)     :null)
	}

	function setResolvedRecipe(recipe:ResolvedRecipe) {
		for (const inItem of recipe.inputs) {
			const cell = createItemCell(inItem.item)
			cell.amountLabel.textContent = String(inItem.amount)
			applyEvents(cell.element, {type:"item", value:inItem})
			input.append(cell.element)
		}
		for (const outItem of recipe.output) {
			const cell = createItemCell(outItem.item)
			cell.amountLabel.textContent = String(outItem.amount)
			applyEvents(cell.element, {type:"item", value:outItem})
			output.append(cell.element)
		}
	}

	let animFunc:(()=>void)[] = []

	function setRecipe(
		recipe:Recipe,
		resolve?:ResolvedRecipe
	) {
		removeAllChildren(input)
		removeAllChildren(output)
		info.textContent = `Time: ${recipe.processTimeSeconds} | Tier:${recipe.requiredTier}`
		if (resolve) {
			setResolvedRecipe(resolve)
		} else {			
			animFunc = []

			for (const rIn of recipe.inputs) {
				if ("id" in rIn) {
					const item = getItemFromId(rIn.id)
					const cell = createItemCell(item)
					cell.amountLabel.textContent = String(rIn.amount)
					applyEvents(cell.element, {type:"item", value:new ItemInstance(item)})
					input.append(cell.element)
				} else {
					const cell = createItemTagCell(rIn.tag)
					if (cell === null) throw new Error(`Cannot find tag: ${rIn.tag} in items: ${items.map(v => v.id).join(", ")}`);
					cell.amountLabel.textContent = String(rIn.amount)
					applyEvents(cell.element, {type:"tag", value:rIn.tag})
					input.append(cell.element)
					animFunc.push(cell.next)
				}
			}
		}

		for (const rOut of recipe.outputs) {
			const cell = createItemCell(getItemFromId(rOut.id))
			cell.amountLabel.textContent = String(rOut.amount || 1)
			applyEvents(cell.element, {type:"item", value:ItemInstance.fromSer(rOut)})
			output.append(cell.element)
		}
	}

	const setMachineRecipe = (machine:Machine) => {
		removeAllChildren(input)
		info.textContent = "Machine recipe"
		setResolvedRecipe(new ResolvedRecipe(0,
			machine.cost.map(val =>
				ItemEntry.fromItem(
					getItemFromId(val.id),
					val.amount
				)
			),
			[]
		))
		removeAllChildren(output)
		const el = document.createElement("img")
		el.src = machine.img
		output.append(el)
	}

	return {
		element:root,
		setRecipe,
		setMachineRecipe,
		animate:()=>animFunc.forEach(f=>f()),
		events,
	} as const
}




export function createInfoPanel() {
	const root = document.createElement('div');
	root.className = 'mouse-info-panel background-gradient';
	root.style.display = 'none';

	const body = document.createElement('div');
	body.className = "mouse-info-panel-body"
	root.append(body)

	const title = document.createElement("span");
	title.className = "mouse-info-panel-title"
	body.append(title);

	const hr = document.createElement("hr");
	hr.className = "background-gradient"
	body.append(hr);

	const description = document.createElement("span")
	description.className = "mouse-info-panel-description"
	body.append(description)

	const footer = document.createElement("span")
	footer.className = "mouse-info-panel-footer"
	body.append(footer)

	return {
		root,
		setTitle: (text: string) => {
			title.textContent = text;
		},
		description
	} as const;
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



