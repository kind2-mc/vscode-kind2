export type Interpretation = {
    blockType: string,
    name: string,
    streams: Stream[],
    activeModes: any
    subnodes: Interpretation[] | undefined
}

export type StreamValue = boolean | number | string | { num: number, den: number } | StreamValue[] ;

export type Stream = {
    name: string,
    type: string,
    typeInfo: any,
    class: string,
    //instantValues: StreamValue[time][?]
    instantValues: StreamValue[][]
}