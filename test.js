const { StateMachine } = require("./AdvStateMachine");


let psm = new StateMachine(null, {
    name: "Pedestrian SM",
    stateMap: {
        standing: {
            initial: true,
            entry: () => { console.log("Standing") },
            transitions: {
                walk: {
                    state: "walking"
                }
            },

            exit: () => { console.log("Stopping standing") }
        },

        walking: {
            entry: () => { console.log("Walking") },
            transitions: {
                stop: {
                    state: "standing"
                }
            },
            exit: () => { console.log("Stopping walking") }
        }

    },
    onSuspend: () => { conole.log("Pedestrian SM suspending") },
    onResume: ()=>{ console.log("resuming Pedestrian SM") },
    memory: true
})


let tl = new StateMachine(null, {
    name: "Traffic light SM",
    stateMap: {
        green: {

            initial: true,
            entry: () => { console.log("Entering green state") },

            transitions: {
                toYellow: {
                    state: "yellow"
                }
            },

            exit: () => { console.log("Exiting green state") },

            substates: psm

        }
    },


    yellow: {
        entry: () => { console.log("Entering yellow state") },

        transitions: {
            toRed: {
                state: "yellow"
            },
            toGreen: {
                state: "green"
            }
        },

        exit: () => { console.log("Exiting yellow state") }

    },
    red: {

        entry: () => { console.log("Entering red state") },

        transitions: {
            toYellow: {
                state: "yellow"
            }
        },

        exit: () => { console.log("Exiting red state") }


    }
})
