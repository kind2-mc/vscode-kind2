export type CounterExample = {
    blockType: string,
    name: string,
    streams: Stream[],
    activeModes: any
}

export type Stream = {
    name: string,
    type: string,
    typeInfo: any,
    class: string,
    instantValues: (boolean | number | string)[][]
}
