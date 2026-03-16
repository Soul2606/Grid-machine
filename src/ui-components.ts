import { getData } from "./game-data.js"
import { type MachineInstance, type Inventory, type SignalInterface, ResolvedRecipe, ItemEntry, ItemInstance } from "./classes.js"
import { clamp, getItemFromId, getItemsFromTag, getRecipeInputs, getRecipeOutputs, maxCraftableCount, removeAllChildren, resolveCraftingCosts } from "./functions.js"
import type { CraftingOptions, Item, Machine, Recipe } from "./types.js"



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

	const setText = (text: string) => { p.textContent = text }

	const methods = {
		show: (x: number, y: number, text: string, length = 15) => {
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
		},
		setEndCallback: (func: QuantitySliderCallback) => {
			endCallbackFunction = func
		},
		setInputCallback: (func: QuantitySliderCallback) => {
			inputCallbackFunction = func
		},
		setText
	} as const
	return { element: root, methods } as const
}




/**
 * Can be mutated! Use itemPointer to get which item this cell currently represents.
 * @param item The item that the cell represents
 * @returns 
 */
export function createItemCell(item: Item) {
	let itemPointer = item
	const cell = document.createElement('div')
	cell.className = 'inventory-grid-cell'
	
	const number = document.createElement('span')
	number.textContent = '0'
	cell.appendChild(number)

	function setItem(item:Item) {
		itemPointer = item
		cell.style.backgroundImage = item.img ? `url(${item.img})` : ''
	}
	setItem(item)

	return {
		element: cell,
		amountLabel: number,
		getItem:()=>itemPointer, 
		setItem
	} as const
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




export function createMachine(machine: Machine) {
	const cell = document.createElement('div')
	cell.className = 'machine'
	cell.textContent = machine.name
	if (machine.img) cell.style.backgroundImage = `url(${machine.img})`

	const stack = document.createElement('p')
	stack.textContent = String(1)

	const setStack = (text: string) => {
		stack.textContent = text
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
		console.log(machine.capableRecipes)
		subscribers = []
		machine.capableRecipes.forEach(cr => {
			const options: CraftingOptions = {}

			const out = getRecipeOutputs(cr)
			console.log(cr)
			console.log("out: ", out)

			const outFirst = out[0]
			if (outFirst === undefined) throw new Error("Recipe produces nothing. id: " + cr.id)

			const cell = createItemCell(outFirst.item)

			const getCount = () => {
				const count = maxCraftableCount(getRecipeInputs(cr), availableResources, options)
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
	const events = {
		onMouseEnter: null as null | ((value:ItemInstance|string)=>void),
		onMouseLeave: null as null | (()=>void),
		onClick:      null as null | ((value:ItemInstance|string)=>void)
	}
	const root = document.createElement("div")
	root.className = "recipe-card"

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

	function applyEvents(element:HTMLElement, value:ItemInstance|string) {
		element.addEventListener("mouseenter", ()=>events.onMouseEnter?events.onMouseEnter(value):null)
		element.addEventListener("mouseleave", ()=>events.onMouseLeave?events.onMouseLeave()     :null)
		element.addEventListener("click",      ()=>events.onClick     ?events.onClick(value)     :null)
	}

	function setResolvedRecipe(recipe:ResolvedRecipe) {
		removeAllChildren(input)
		removeAllChildren(output)
		for (const inItem of recipe.inputs) {
			const cell = createItemCell(inItem.item)
			cell.amountLabel.textContent = String(inItem.amount)
			applyEvents(cell.element, inItem)
			input.append(cell.element)
		}
		for (const outItem of recipe.output) {
			const cell = createItemCell(outItem.item)
			cell.amountLabel.textContent = String(outItem.amount)
			applyEvents(cell.element, outItem)
			output.append(cell.element)
		}
	}

	let animFunc:(()=>void)[] = []

	function setRecipe(
		recipe:Recipe
	) {
		removeAllChildren(input)
		removeAllChildren(output)
		animFunc = []

		for (const rIn of recipe.inputs) {
			if ("id" in rIn) {
				const item = getItemFromId(rIn.id)
				const cell = createItemCell(item)
				cell.amountLabel.textContent = String(rIn.amount)
				applyEvents(cell.element, new ItemInstance(item))
				input.append(cell.element)
			} else {
				const cell = createItemTagCell(rIn.tag)
				if (cell === null) throw new Error(`Cannot find tag: ${rIn.tag} in items: ${items.map(v => v.id).join(", ")}`);
				cell.amountLabel.textContent = String(rIn.amount)
				applyEvents(cell.element, rIn.tag)
				input.append(cell.element)
				animFunc.push(cell.next)
			}
		}

		for (const rOut of recipe.outputs) {
			const cell = createItemCell(getItemFromId(rOut.id))
			cell.amountLabel.textContent = String(rOut.amount || 1)
			applyEvents(cell.element, ItemInstance.fromRef(rOut))
			output.append(cell.element)
		}
	}

	return {
		element:root,
		setRecipe,
		setResolvedRecipe,
		animate:()=>animFunc.forEach(f=>f()),
		events,
	} as const
}



