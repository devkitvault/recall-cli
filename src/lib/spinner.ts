import ora from 'ora'

const DELAY_MS = 120

export function delayedSpinner(label: string): { stop: () => void } {
    let spinner: ReturnType<typeof ora> | null = null
    const timer = setTimeout(() => {
        spinner = ora(label).start()
    }, DELAY_MS)
    return {
        stop() {
            clearTimeout(timer)
            spinner?.stop()
        },
    }
}
