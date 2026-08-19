export type SignalInterface<P, R> = {
	subscribe: (fnc: (param: P) => R)=> () => boolean
	once: (fnc: (param: P) => R)=> () => boolean
	unsubscribe: (fnc: (param: P) => R)=> boolean
	clear?: ()=> void
}




export class Signal<P = unknown, R = void> {
	private listeners = new Set<(param: P) => R>()
	private onceListener = new Set<(param: P) => R>()

	subscribe(fnc: (param: P) => R) {
		this.listeners.add(fnc)
		return () => this.listeners.delete(fnc)
	}

	once(fnc: (param: P) => R) {
		this.onceListener.add(fnc)
		return () => this.onceListener.delete(fnc)
	}

	unsubscribe(fnc: (param: P) => R): boolean {
		return this.listeners.delete(fnc) || this.onceListener.delete(fnc)
	}

	clear(){
		this.listeners.clear()
		this.onceListener.clear()
	}

	send(param: P): R[] {
		const results: R[] = []
		this.listeners.forEach(f => results.push(f(param)))
		this.onceListener.forEach(f => results.push(f(param)))
		this.onceListener.clear()
		return results
	}

	createInterface(includeClear: boolean): SignalInterface<P, R> {
		const self = this

		const api: SignalInterface<P, R> = {
			subscribe: fnc => self.subscribe(fnc),
			once: fnc => self.once(fnc),
			unsubscribe: fnc => self.unsubscribe(fnc),
		}

		if (includeClear) {
			api.clear = () => self.clear()
		}

		return api
	}

}