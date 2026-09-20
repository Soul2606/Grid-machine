import type { Machine } from "../classes/machine.js"
import { type Inventory } from '../classes/inventory.js'
import { getItemFromId, maxCraftableCount, resolveCraftingCosts } from "../crafting-system/functions.js"
import { stepExponential } from "../common/utils.js"
import { clamp } from "../common/utils.js"
import type { CraftingOptions } from "../crafting-system/types.js"
import { createItemCell } from "../common/ui-components.js"
import type { SignalInterface } from "../lib/events/signal.js";




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

	const refresh = (machine: Machine, availableResources: Inventory) => {
		refreshText(machine)

		grid.innerHTML = ""
		subscribers = []
		machine.capableRecipes.forEach(cr => {
			const options: CraftingOptions = {}

			const out = cr.outputs
			console.log("out: ", out.map(o=>o.id).join(","))

			const outFirst = out[0]
			if (outFirst === undefined) throw new Error("Recipe produces nothing.")

			const cell = createItemCell(getItemFromId(outFirst.id))

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

	const refreshText = (machine: Machine) => {
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

