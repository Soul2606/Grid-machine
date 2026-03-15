import { Signal } from "./classes.js"


const pressed = new Set<string>()
const keydown = new Signal<string>()
const keyup = new Signal<string>()

window.addEventListener("keydown", (e) => {
	pressed.add(e.code)
	keydown.send(e.code)
})

window.addEventListener("keyup", (e) => {
	pressed.delete(e.code)
	keyup.send(e.code)
})

export function isPressed(code: string): boolean {
	return pressed.has(code)
}

export function getSignals() {
	return {
		keydown: keydown.createInterface(false),
		keyup: keyup.createInterface(false)
	}
}