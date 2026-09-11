/** Printed Ask source. API/DB still use `llm` for generated answers. */
export function sourceLabel(source: string): string {
    return source === 'llm' ? 'recall agent' : source
}
