import { Signal } from "./lib/events/signal.js"


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

/**
 * Returns true if the given code is currently pressed.
 * @param code Keyboard event code
 * @returns the key is pressed
 */
export function isPressed(code: string): boolean {
	return pressed.has(code)
}

/**
 * Returns two interfaces for a pubsub that is called with a key code when a key is pressed or released.
 * 
 * Warning! This can cause a memory leak if unused events are not unsubscribed.
 */
export function getSignals() {
	return {
		keydown: keydown.createInterface(false),
		keyup: keyup.createInterface(false)
	}
}