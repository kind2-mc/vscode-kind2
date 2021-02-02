export interface CounterExample {
    blockType: string,
    name: string,
    streams: [Stream],
    activeModes: any
}

export interface Stream {
    name: string,
    type: string,
    class: string,
    instantValues: [[boolean | number | string]]
}
