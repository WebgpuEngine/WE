
export function    createWrieFrame(position: number[], indeices: number[]) {
        let list: { [name: string]: number[] };
        list = {};
        if (indeices.length == 0) {
            let i_index = 0;
            for (let i = 0; i < position.length / 3; i++) {
                list[i_index++] = [i, i + 1];
                list[i_index++] = [i + 1, i + 2];
                list[i_index++] = [i + 2, i];

            }
        }
        else {
            for (let i = 0; i < indeices.length; i += 3) {
                let A = indeices[i];
                let B = indeices[i + 1];
                let C = indeices[i + 2];
                let AB = [A, B].sort().toString();
                let BC = [B, C].sort().toString();
                let CA = [C, A].sort().toString();
                list[AB] = [A, B];
                list[BC] = [B, C];
                list[CA] = [C, A];
            }
        }
        let indeicesWireframe: number[] = [];
        for (let i in list) {
            indeicesWireframe.push(list[i][0], list[i][1]);
        }
        return indeicesWireframe;
    }