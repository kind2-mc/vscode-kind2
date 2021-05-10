export type Interpretation = {
    blockType: string,
    name: string,
    streams: Stream[],
    activeModes: any
    subnodes: Interpretation[] | undefined
}

export type Stream = {
    name: string,
    type: string,
    typeInfo: any,
    class: string,
    instantValues: (boolean | number | string)[][]
}
